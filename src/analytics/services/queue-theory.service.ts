import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ProductAnalytics } from '../entities/product-analytics.entity';
import { ClickTracking } from '../entities/click-tracking.entity';
import { StockHistory } from '../entities/stock-history.entity';
import { Product } from '../../products/entities/product.entity';

export interface QueueMetrics {
  lambda: number; // Tasa de llegadas (clicks/día)
  mu: number; // Tasa de servicio (reposiciones/día)
  rho: number; // Factor de utilización
  status: 'ESTABLE' | 'ADVERTENCIA' | 'CRITICO';
  message: string;
  muCalculationDetails?: MuCalculationDetails; // Detalles del cálculo de μ
}

export interface MuCalculationDetails {
  calculationMethod: string; // Método usado para calcular μ
  repositionsCount: number; // Número de reposiciones encontradas
  depletionsCount: number; // Número de agotamientos
  repositionDates: string[]; // Fechas de reposiciones
  daysBetweenRepositions: number[]; // Días entre cada reposición
  averageDaysBetween: number; // Promedio de días entre reposiciones
  rawMu: number; // μ antes de penalizaciones
  depletionPenalty: number; // Factor de penalización por agotamientos
  finalMu: number; // μ final después de penalizaciones
  explanation: string; // Explicación del cálculo paso a paso
}

@Injectable()
export class QueueTheoryService {
  constructor(
    @InjectRepository(ProductAnalytics)
    private readonly analyticsRepository: Repository<ProductAnalytics>,
    @InjectRepository(ClickTracking)
    private readonly clickRepository: Repository<ClickTracking>,
    @InjectRepository(StockHistory)
    private readonly stockRepository: Repository<StockHistory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}  /**
   * Calcula las métricas M/M/1 para un producto específico
   * ✅ MEJORADO: Maneja mejor los casos edge y productos sin historial
   */
  async calculateQueueMetrics(productId: string, analysisPeriodDays: number = 30): Promise<QueueMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - analysisPeriodDays);

    console.log(`🧮 CALCULATING QUEUE METRICS for product: ${productId} (period: ${analysisPeriodDays} days)`);

    // Calcular λ (Lambda) - Tasa de llegadas
    const lambda = await this.calculateArrivalRate(productId, startDate, endDate, analysisPeriodDays);

    // Calcular μ (Mu) - Tasa de servicio CON DETALLES
    const muResult = await this.calculateServiceRateWithDetails(productId, startDate, endDate);
    const mu = muResult.finalMu;

    // ✅ CÁLCULO MEJORADO DE ρ (Rho) - Factor de utilización
    let rho: number;
    let status: 'ESTABLE' | 'ADVERTENCIA' | 'CRITICO';
    let message: string;

    if (mu === 0) {
      // Caso especial: μ = 0 (no debería pasar con el nuevo algoritmo, pero por seguridad)
      rho = Infinity;
      status = 'CRITICO';
      message = `CRÍTICO - Sin datos de reposición. Demanda: ${lambda.toFixed(2)} clicks/día.`;
    } else {
      rho = lambda / mu;
      status = this.determineQueueStatus(rho);
      message = this.generateStatusMessage(rho, lambda, mu);
    }

    console.log(`📊 FINAL METRICS CALCULATION for product ${productId}:`, {
      lambda: lambda.toFixed(4),
      mu: mu.toFixed(4),
      rho: rho === Infinity ? 'Infinity' : rho.toFixed(4),
      status,
      rhoCritical: rho >= 0.8,
      rhoWarning: rho >= 0.5 && rho < 0.8,
      rhoStable: rho < 0.5
    });

    console.log(`📊 FINAL METRICS - λ: ${lambda}, μ: ${mu}, ρ: ${rho}, status: ${status}`);    return {
      lambda: Number(lambda.toFixed(4)),
      mu: Number(mu.toFixed(4)),
      rho: rho === Infinity ? 999.9999 : Number(rho.toFixed(4)), // Evitar Infinity en JSON
      status,
      message,
      muCalculationDetails: muResult // ✅ Agregar detalles del cálculo de μ
    };
  }  /**
   * Calcula la tasa de llegadas (λ) - clicks por día
   * ✅ MEJORADO: Incluye tanto CLICK como VIEW según la fundamentación teórica
   */  private async calculateArrivalRate(
    productId: string, 
    startDate: Date, 
    endDate: Date, 
    periodDays: number
  ): Promise<number> {
    // ✅ SEGÚN LA FUNDAMENTACIÓN TEÓRICA OFICIAL:
    // "Tasa de llegadas (λ): Número de clicks en un producto específico por unidad de tiempo"
    // λ = Clicks_en_producto / Período_tiempo
    
    const clickCount = await this.clickRepository.count({
      where: {
        product: { id: productId },
        createdAt: Between(startDate, endDate),
        interactionType: 'CLICK'
      }
    });

    // ✅ FÓRMULA CORREGIDA: Solo clicks (no views)
    const lambda = clickCount / periodDays;
    
    console.log(`📊 LAMBDA CALCULATION (CORRECTED) for product ${productId}:`, {
      totalClicks: clickCount,
      periodDays,
      lambda: lambda.toFixed(4),
      formula: 'λ = clicks / días',
      note: 'Según fundamentación teórica: solo clicks representan demanda real'
    });

    return lambda;
  }/**
   * Calcula la tasa de servicio (μ) - capacidad de reposición por día
   * ✅ MEJORADO: Considera tanto reposiciones como agotamientos
   */
  private async calculateServiceRate(productId: string, startDate: Date, endDate: Date): Promise<number> {
    // Buscar reposiciones Y agotamientos en el período
    const reposiciones = await this.stockRepository.find({
      where: {
        product: { id: productId },
        changeType: 'REPOSITION',
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    const agotamientos = await this.stockRepository.find({
      where: {
        product: { id: productId },
        changeType: 'DEPLETION',
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    console.log(`📊 ANALYZING SERVICE RATE for product ${productId}:`, {
      reposiciones: reposiciones.length,
      agotamientos: agotamientos.length,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`
    });

    // ✅ CASO 1: Agotamiento reciente sin reposiciones (μ muy baja)
    if (agotamientos.length > 0 && reposiciones.length === 0) {
      console.log(`🔴 PRODUCT DEPLETED WITHOUT REPOSITIONS - Setting low μ`);
      return 0.1; // μ muy baja = el sistema no puede mantener el stock
    }

    // ✅ CASO 2: Agotamientos frecuentes (reduce μ)
    if (agotamientos.length >= 2) {
      console.log(`🟡 FREQUENT DEPLETIONS DETECTED - Reducing μ`);
      // Si hay muchos agotamientos, la capacidad de servicio es baja
      return Math.max(0.2, 1 / agotamientos.length); // Penalizar por agotamientos frecuentes
    }

    // ✅ CASO 3: Agotamiento reciente (reduce μ basado en tiempo)
    if (agotamientos.length === 1) {
      const lastDepletion = agotamientos[0];
      const daysSinceDepletion = (new Date().getTime() - lastDepletion.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDepletion <= 7) { // Agotamiento en los últimos 7 días
        console.log(`🔴 RECENT DEPLETION (${daysSinceDepletion.toFixed(1)} days ago) - Reducing μ`);
        return 0.3; // μ reducida por agotamiento reciente
      }
    }    // ✅ CASO 4: Producto con suficientes reposiciones (≥2)
    if (reposiciones.length >= 2) {
      console.log(`📊 CALCULATING μ from ${reposiciones.length} repositions for product ${productId}`);
      
      let totalDaysBetweenRepositions = 0;
      let repositionCount = 0;

      for (let i = 1; i < reposiciones.length; i++) {
        const timeDiff = reposiciones[i].createdAt.getTime() - reposiciones[i-1].createdAt.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        totalDaysBetweenRepositions += daysDiff;
        repositionCount++;
      }

      const averageDaysBetweenRepositions = totalDaysBetweenRepositions / repositionCount;
      let mu = 1 / averageDaysBetweenRepositions;
      
      // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS (penalizar)
      if (agotamientos.length > 0) {
        const depletionPenalty = 1 - (agotamientos.length * 0.2); // Reducir μ por cada agotamiento
        mu *= Math.max(0.1, depletionPenalty); // No reducir μ por debajo de 0.1
        console.log(`🔴 APPLYING DEPLETION PENALTY: ${agotamientos.length} depletions, penalty: ${depletionPenalty.toFixed(2)}`);
      }
      
      console.log(`✅ μ calculated from history: ${mu.toFixed(4)} repositions/day`);
      return mu;
    }    // ✅ CASO 5: Producto con 1 reposición (usar estimación basada en tiempo desde creación)
    if (reposiciones.length === 1) {
      console.log(`📊 ESTIMATING μ from single reposition for product ${productId}`);
      
      // Obtener fecha de creación del producto
      const product = await this.productRepository.findOne({
        where: { id: productId },
        select: ['datePublication', 'stock']
      });

      if (product && product.datePublication) {
        const daysSinceCreation = (reposiciones[0].createdAt.getTime() - product.datePublication.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreation > 0) {
          let estimatedMu = 1 / daysSinceCreation;
          
          // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS
          if (agotamientos.length > 0) {
            const depletionPenalty = 1 - (agotamientos.length * 0.3); // Penalidad más fuerte para productos con pocas reposiciones
            estimatedMu *= Math.max(0.1, depletionPenalty);
            console.log(`🔴 APPLYING DEPLETION PENALTY to single reposition: ${agotamientos.length} depletions`);
          }
          
          console.log(`✅ μ estimated from creation to first reposition: ${estimatedMu.toFixed(4)} repositions/day`);
          return estimatedMu;
        }
      }
    }

    // ✅ CASO 6: Producto sin reposiciones pero con stock actual > 0 (producto nuevo o estable)
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['datePublication', 'stock']
    });

    if (product && product.stock > 0) {
      console.log(`📊 HANDLING new/stable product without repositions for product ${productId}`);
      
      const daysSinceCreation = (new Date().getTime() - product.datePublication.getTime()) / (1000 * 60 * 60 * 24);
      
      // ✅ Estrategia para productos nuevos/estables:
      // Asumir que el producto ha sido "estable" desde su creación
      // Esto da un μ bajo, lo que resulta en ρ alto solo si hay mucha demanda
      if (daysSinceCreation >= 7) { // Al menos 1 semana de vida
        // Asumir una reposición por el período de vida del producto
        let conservativeEstimate = 1 / daysSinceCreation;
        
        // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS
        if (agotamientos.length > 0) {
          const depletionPenalty = 1 - (agotamientos.length * 0.4); // Penalidad muy fuerte para productos sin reposiciones
          conservativeEstimate *= Math.max(0.05, depletionPenalty);
          console.log(`🔴 APPLYING HEAVY DEPLETION PENALTY to product without repositions: ${agotamientos.length} depletions`);
        }
        
        console.log(`✅ μ estimated for stable product: ${conservativeEstimate.toFixed(4)} repositions/day (${daysSinceCreation} days old)`);
        return conservativeEstimate;
      }
    }

    // ✅ CASO 7: Producto muy nuevo (< 7 días) - usar valor por defecto conservador
    console.log(`⚠️ USING default μ for very new product ${productId}`);
    
    // Si hay agotamientos en un producto muy nuevo, es una señal muy mala
    if (agotamientos.length > 0) {
      console.log(`🔴 CRITICAL: New product with depletions - very low μ`);
      return 0.05; // μ muy baja para productos nuevos que ya se agotaron
    }
    
    // Asumir reposición cada 30 días como estimación conservadora
    return 1 / 30; // 0.033 reposiciones/día
  }
  /**
   * Calcula la tasa de servicio (μ) CON DETALLES del cálculo paso a paso
   * ✅ NUEVO: Para mostrar en el modal cómo se calcula μ
   */
  private async calculateServiceRateWithDetails(productId: string, startDate: Date, endDate: Date): Promise<MuCalculationDetails> {
    // Buscar reposiciones Y agotamientos en el período
    const reposiciones = await this.stockRepository.find({
      where: {
        product: { id: productId },
        changeType: 'REPOSITION',
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    const agotamientos = await this.stockRepository.find({
      where: {
        product: { id: productId },
        changeType: 'DEPLETION',
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    // Preparar datos para los detalles
    const repositionDates = reposiciones.map(r => r.createdAt.toISOString().split('T')[0]);
    const repositionsCount = reposiciones.length;
    const depletionsCount = agotamientos.length;    // ✅ CASO 1: Agotamiento reciente sin reposiciones (μ muy baja)
    if (agotamientos.length > 0 && reposiciones.length === 0) {
      return {
        calculationMethod: 'Penalización por agotamiento sin reposiciones',
        repositionsCount,
        depletionsCount,
        repositionDates,
        daysBetweenRepositions: [],
        averageDaysBetween: 0,
        rawMu: 0,
        depletionPenalty: 1,
        finalMu: 0.1,
        explanation: `� CASO CRÍTICO: AGOTAMIENTO SIN REPOSICIONES

🔍 ANÁLISIS DE LA SITUACIÓN:
Se detectaron ${depletionsCount} agotamiento(s) de stock en los últimos 30 días, pero NO se registraron reposiciones.

📊 DATOS DEL SISTEMA:
• Período analizado: últimos 30 días
• Reposiciones encontradas: 0 eventos
• Agotamientos detectados: ${depletionsCount} eventos
• Estado actual: Producto probablemente sin stock

🎓 INTERPRETACIÓN TEÓRICA:
En el modelo M/M/1, μ representa la capacidad de servicio.
Sin reposiciones, μ ≈ 0, lo que significa capacidad de servicio nula.

⚠️ ASIGNACIÓN DE μ CRÍTICO:
Dado que μ = 0 haría que ρ = λ/μ → ∞ (sistema colapso), 
asignamos μ = 0.1 como valor crítico mínimo.

🔄 SIGNIFICADO PRÁCTICO:
μ = 0.1 reposiciones/día = 1 reposición cada 10 días
Esto representa una capacidad de servicio extremadamente baja.

💼 IMPLICACIONES PARA EL NEGOCIO:
• El vendedor no está reponiendo stock activamente
• Alto riesgo de pérdida de ventas por falta de producto
• Sistema en estado crítico (ρ probablemente > 1)
• Requiere intervención inmediata

🎯 RECOMENDACIONES:
1. Contactar al vendedor para verificar disponibilidad
2. Implementar alertas de stock mínimo
3. Revisar proceso de gestión de inventario
4. Considerar cambio de proveedor si persiste

🔬 NOTA METODOLÓGICA:
Este valor de μ = 0.1 es conservador y refleja la realidad operativa
donde la falta de reposiciones indica problemas graves en el suministro.`
      };
    }    // ✅ CASO 2: Agotamientos frecuentes (reduce μ)
    if (agotamientos.length >= 2) {
      const finalMu = Math.max(0.2, 1 / agotamientos.length);
      return {
        calculationMethod: 'Penalización por agotamientos frecuentes',
        repositionsCount,
        depletionsCount,
        repositionDates,
        daysBetweenRepositions: [],
        averageDaysBetween: 0,
        rawMu: 1 / agotamientos.length,
        depletionPenalty: 1,
        finalMu,
        explanation: `🟡 CASO DE MÚLTIPLES AGOTAMIENTOS

🔍 ANÁLISIS DE LA SITUACIÓN:
Se detectaron ${depletionsCount} agotamientos de stock en los últimos 30 días.
Esto indica un patrón problemático en la gestión del inventario.

📊 DATOS DEL SISTEMA:
• Período analizado: últimos 30 días
• Agotamientos detectados: ${depletionsCount} eventos
• Reposiciones encontradas: ${repositionsCount} eventos
• Patrón: Agotamientos frecuentes

🎓 METODOLOGÍA DE CÁLCULO:
Cuando hay múltiples agotamientos, usamos una heurística conservadora:
μ = max(0.2, 1/número_agotamientos)

🧮 CÁLCULO PASO A PASO:
μ_base = 1 ÷ ${depletionsCount} = ${(1/agotamientos.length).toFixed(4)}
μ_final = max(0.2, ${(1/agotamientos.length).toFixed(4)}) = ${finalMu.toFixed(4)}

🔄 SIGNIFICADO PRÁCTICO:
μ = ${finalMu.toFixed(4)} reposiciones/día = 1 reposición cada ${(1/finalMu).toFixed(1)} días

💡 INTERPRETACIÓN:
Los agotamientos frecuentes sugieren que aunque pueda haber reposiciones,
la frecuencia y/o cantidad no son suficientes para mantener stock estable.

⚠️ IMPLICACIONES DEL MODELO M/M/1:
• Alta probabilidad de que ρ > 0.8 (sistema congestionado)
• Mayor tiempo de espera para clientes
• Riesgo de pérdida de ventas por falta de disponibilidad
• Necesidad de mejorar la gestión de inventario

💼 RECOMENDACIONES OPERATIVAS:
1. Aumentar la frecuencia de reposiciones
2. Incrementar el stock de seguridad
3. Implementar alertas automáticas de stock bajo
4. Revisar proveedores y tiempos de entrega
5. Analizar patrones de demanda para anticipar necesidades

🔬 NOTA TÉCNICA:
El límite mínimo de μ = 0.2 evita valores extremadamente bajos que
podrían no reflejar la realidad operativa del negocio.`
      };
    }    // ✅ CASO 3: Agotamiento reciente (reduce μ basado en tiempo)
    if (agotamientos.length === 1) {
      const lastDepletion = agotamientos[0];
      const daysSinceDepletion = (new Date().getTime() - lastDepletion.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDepletion <= 7) {
        return {
          calculationMethod: 'Penalización por agotamiento reciente',
          repositionsCount,
          depletionsCount,
          repositionDates,
          daysBetweenRepositions: [],
          averageDaysBetween: 0,
          rawMu: 0,
          depletionPenalty: 1,
          finalMu: 0.3,
          explanation: `🔴 CASO DE AGOTAMIENTO RECIENTE

🔍 ANÁLISIS DE LA SITUACIÓN:
Se detectó 1 agotamiento de stock hace ${daysSinceDepletion.toFixed(1)} días (menos de 7 días).
Un agotamiento reciente es una señal de alerta importante.

📊 DATOS DEL SISTEMA:
• Período analizado: últimos 30 días
• Agotamientos detectados: 1 evento
• Fecha del agotamiento: ${lastDepletion.createdAt.toISOString().split('T')[0]}
• Días desde el agotamiento: ${daysSinceDepletion.toFixed(1)} días
• Reposiciones encontradas: ${repositionsCount} eventos

🎓 CRITERIO DE PENALIZACIÓN:
Agotamientos en los últimos 7 días reciben penalización especial porque:
• Indican problemas operativos recientes
• Sugieren capacidad de reposición insuficiente
• Aumentan el riesgo de nuevos agotamientos

⚠️ ASIGNACIÓN DE μ PENALIZADO:
Se asigna μ = 0.3 como valor conservador que refleja:
• Capacidad de reposición comprometida recientemente
• Riesgo elevado de repetir el agotamiento
• Necesidad de monitoreo cercano

🔄 SIGNIFICADO PRÁCTICO:
μ = 0.3 reposiciones/día = 1 reposición cada 3.3 días
Esta frecuencia puede ser insuficiente si la demanda es alta.

📈 COMPARACIÓN CON ESCENARIOS:
• μ > 0.5: Capacidad buena
• μ = 0.3: Capacidad limitada (actual)
• μ < 0.2: Capacidad crítica

💼 IMPLICACIONES PARA EL NEGOCIO:
• Riesgo medio-alto de nuevo agotamiento
• Posible pérdida de ventas si demanda aumenta
• Necesidad de mejorar reactividad en reposiciones
• Monitoreo continuo requerido

🎯 RECOMENDACIONES INMEDIATAS:
1. Verificar stock actual del producto
2. Acelerar próxima reposición si es necesaria
3. Analizar las causas del agotamiento reciente
4. Considerar aumentar stock de seguridad
5. Implementar alertas tempranas de stock bajo

🔬 NOTA METODOLÓGICA:
La penalización por agotamiento reciente (< 7 días) es más conservadora
que agotamientos antiguos porque refleja problemas operativos actuales.`
        };
      }
    }

    // ✅ CASO 4: Producto con suficientes reposiciones (≥2) - CÁLCULO PRINCIPAL
    if (reposiciones.length >= 2) {
      let totalDaysBetweenRepositions = 0;
      let repositionCount = 0;
      const daysBetweenRepositions: number[] = [];

      for (let i = 1; i < reposiciones.length; i++) {
        const timeDiff = reposiciones[i].createdAt.getTime() - reposiciones[i-1].createdAt.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        daysBetweenRepositions.push(Number(daysDiff.toFixed(2)));
        totalDaysBetweenRepositions += daysDiff;
        repositionCount++;
      }      const averageDaysBetweenRepositions = totalDaysBetweenRepositions / repositionCount;
      let rawMu = 1 / averageDaysBetweenRepositions;
      let finalMu = rawMu;
      let depletionPenalty = 1;
        // ✅ EXPLICACIÓN SUPER DETALLADA Y EDUCATIVA
      let explanation = `🎓 FUNDAMENTO TEÓRICO - MODELO M/M/1:\n`;
      explanation += `El modelo M/M/1 es una herramienta matemática utilizada para analizar sistemas de colas.\n`;
      explanation += `En nuestro contexto de e-commerce:\n`;
      explanation += `• λ (lambda) = clicks de clientes por día (demanda)\n`;
      explanation += `• μ (mu) = capacidad de reposición del vendedor por día (servicio)\n`;
      explanation += `• ρ (rho) = λ/μ = factor de utilización del sistema\n\n`;
      
      explanation += `🔬 ¿QUÉ ES μ (TASA DE SERVICIO)?\n`;
      explanation += `μ representa qué tan rápido puede el vendedor satisfacer la demanda.\n`;
      explanation += `• Si μ = 0.5, el vendedor repone stock cada 2 días en promedio\n`;
      explanation += `• Si μ = 1.0, el vendedor repone stock diariamente\n`;
      explanation += `• Si μ = 2.0, el vendedor repone stock 2 veces por día\n`;
      explanation += `FÓRMULA: μ = 1 / tiempo_promedio_entre_reposiciones\n\n`;
      
      explanation += `📊 DATOS RECOLECTADOS DEL SISTEMA:\n`;
      explanation += `• Período de análisis: últimos 30 días\n`;
      explanation += `• Reposiciones encontradas: ${repositionsCount} eventos\n`;
      explanation += `• Agotamientos detectados: ${depletionsCount} eventos\n`;
      explanation += `• Fechas de reposiciones: ${repositionDates.join(', ')}\n\n`;
      
      explanation += `⏱️ ANÁLISIS DETALLADO DE INTERVALOS:\n`;
      explanation += `Para calcular μ necesitamos el tiempo promedio entre reposiciones.\n`;
      explanation += `Calculamos la diferencia en días entre cada reposición consecutiva:\n\n`;
      for (let i = 0; i < daysBetweenRepositions.length; i++) {
        const fromDate = repositionDates[i];
        const toDate = repositionDates[i + 1];
        const days = daysBetweenRepositions[i];
        explanation += `📅 Intervalo ${i + 1}: ${fromDate} → ${toDate}\n`;
        explanation += `   Días transcurridos: ${days} días\n\n`;
      }
      
      explanation += `� CÁLCULO DEL PROMEDIO ARITMÉTICO:\n`;
      explanation += `Sumamos todos los intervalos y dividimos por el número de intervalos:\n`;
      explanation += `Fórmula: Promedio = (Suma de intervalos) ÷ (Número de intervalos)\n`;
      explanation += `Cálculo: (${daysBetweenRepositions.join(' + ')}) ÷ ${repositionCount}\n`;
      explanation += `Resultado: ${totalDaysBetweenRepositions.toFixed(2)} ÷ ${repositionCount} = ${averageDaysBetweenRepositions.toFixed(2)} días\n\n`;
      
      explanation += `🧮 APLICACIÓN DE LA FÓRMULA PRINCIPAL:\n`;
      explanation += `Usamos la fórmula fundamental: μ = 1 / T\n`;
      explanation += `Donde T = tiempo promedio entre reposiciones = ${averageDaysBetweenRepositions.toFixed(2)} días\n`;
      explanation += `Sustituyendo: μ = 1 ÷ ${averageDaysBetweenRepositions.toFixed(2)} = ${rawMu.toFixed(4)} reposiciones/día\n\n`;
      
      explanation += `💡 INTERPRETACIÓN PRÁCTICA:\n`;
      if (rawMu >= 1) {
        explanation += `✅ EXCELENTE: μ = ${rawMu.toFixed(2)} reposiciones/día\n`;
        explanation += `El vendedor repone stock ${rawMu.toFixed(1)} veces por día en promedio.\n`;
        explanation += `Esto indica una capacidad de servicio MUY ALTA.\n`;
        explanation += `Ejemplo: Si hay 10 clicks por día, puede manejar la demanda fácilmente.\n`;
      } else if (rawMu >= 0.5) {
        explanation += `👍 BUENO: μ = ${rawMu.toFixed(2)} reposiciones/día\n`;
        explanation += `El vendedor repone stock cada ${(1/rawMu).toFixed(1)} días en promedio.\n`;
        explanation += `Esto indica una capacidad de servicio MEDIA-ALTA.\n`;
        explanation += `Ejemplo: Puede manejar demanda moderada sin problemas.\n`;
      } else if (rawMu >= 0.1) {
        explanation += `⚠️ REGULAR: μ = ${rawMu.toFixed(2)} reposiciones/día\n`;
        explanation += `El vendedor repone stock cada ${(1/rawMu).toFixed(1)} días en promedio.\n`;
        explanation += `Esto indica una capacidad de servicio BAJA.\n`;
        explanation += `Ejemplo: Solo puede manejar demanda ligera, riesgo de agotamientos.\n`;
      } else {
        explanation += `🚨 CRÍTICO: μ = ${rawMu.toFixed(2)} reposiciones/día\n`;
        explanation += `El vendedor repone stock cada ${(1/rawMu).toFixed(0)} días en promedio.\n`;
        explanation += `Esto indica una capacidad de servicio MUY BAJA.\n`;
        explanation += `Ejemplo: Alto riesgo de agotamientos frecuentes.\n`;
      }
        // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS (penalizar)
      if (agotamientos.length > 0) {
        depletionPenalty = 1 - (agotamientos.length * 0.2);
        depletionPenalty = Math.max(0.1, depletionPenalty);
        finalMu = rawMu * depletionPenalty;
        
        explanation += `\n🔴 ANÁLISIS DE AGOTAMIENTOS (FACTOR DE CORRECCIÓN):\n`;
        explanation += `Se detectaron ${depletionsCount} agotamiento(s) de stock durante el período.\n`;
        explanation += `Los agotamientos son eventos críticos que indican que la demanda superó la capacidad de servicio.\n\n`;
        
        explanation += `📉 ¿POR QUÉ APLICAMOS UNA PENALIZACIÓN?\n`;
        explanation += `Aunque el vendedor reponía stock regularmente, no logró evitar quedarse sin productos.\n`;
        explanation += `Esto significa que la capacidad real de servicio es menor a la calculada teóricamente.\n`;
        explanation += `La penalización refleja esta realidad operativa.\n\n`;
        
        explanation += `🧮 CÁLCULO DEL FACTOR DE PENALIZACIÓN:\n`;
        explanation += `Fórmula: Factor = 1 - (número_agotamientos × 0.2)\n`;
        explanation += `Donde 0.2 es el peso de penalización por cada agotamiento.\n`;
        explanation += `Sustituyendo: Factor = 1 - (${depletionsCount} × 0.2)\n`;
        explanation += `Cálculo: Factor = 1 - ${(depletionsCount * 0.2).toFixed(1)} = ${depletionPenalty.toFixed(2)}\n`;
        explanation += `Límite mínimo: Factor ≥ 0.1 (para evitar μ = 0)\n\n`;
        
        explanation += `🎯 APLICACIÓN DE LA CORRECCIÓN:\n`;
        explanation += `μ_corregido = μ_original × factor_penalización\n`;
        explanation += `μ_corregido = ${rawMu.toFixed(4)} × ${depletionPenalty.toFixed(2)} = ${finalMu.toFixed(4)} reposiciones/día\n\n`;
        
        explanation += `📊 IMPACTO DE LA CORRECCIÓN:\n`;
        const impactPercent = ((rawMu - finalMu) / rawMu * 100).toFixed(1);
        explanation += `• Reducción absoluta: ${(rawMu - finalMu).toFixed(4)} reposiciones/día\n`;
        explanation += `• Reducción porcentual: ${impactPercent}%\n`;
        explanation += `• Interpretación: Los agotamientos revelan que la capacidad real es ${impactPercent}% menor.\n\n`;
        
        if (depletionsCount === 1) {
          explanation += `⚠️ SIGNIFICADO DE 1 AGOTAMIENTO:\n`;
          explanation += `Un agotamiento puede ser normal en operaciones complejas, pero indica\n`;
          explanation += `que la demanda ocasionalmente supera la capacidad de reposición.\n`;
        } else {
          explanation += `🚨 SIGNIFICADO DE ${depletionsCount} AGOTAMIENTOS:\n`;
          explanation += `Múltiples agotamientos sugieren un problema sistémico en la gestión del inventario.\n`;
          explanation += `El vendedor podría necesitar mejorar sus procesos de reposición.\n`;
        }
      } else {
        explanation += `\n✅ ANÁLISIS DE AGOTAMIENTOS:\n`;
        explanation += `No se detectaron agotamientos en el período de análisis.\n`;
        explanation += `Esto es una excelente señal que indica:\n`;
        explanation += `• El vendedor mantiene un buen control del inventario\n`;
        explanation += `• La capacidad de servicio es adecuada para la demanda actual\n`;
        explanation += `• No hay necesidad de aplicar penalizaciones\n`;
        explanation += `• μ se mantiene sin correcciones = ${rawMu.toFixed(4)} reposiciones/día\n`;
      }
      
      explanation += `\n🎯 RESULTADO FINAL Y ANÁLISIS COMPLETO:\n`;
      explanation += `μ_final = ${finalMu.toFixed(4)} reposiciones/día\n\n`;
      
      explanation += `🔄 FRECUENCIA DE REPOSICIÓN:\n`;
      explanation += `Con μ = ${finalMu.toFixed(4)}, el vendedor repone stock cada ${(1/finalMu).toFixed(1)} días en promedio.\n\n`;
      
      explanation += `⚖️ BALANCE DEMANDA vs CAPACIDAD:\n`;
      explanation += `Para que el sistema sea estable, se requiere que λ < μ (demanda < capacidad).\n`;
      explanation += `• Si λ = ${finalMu.toFixed(1)}, entonces ρ = λ/μ = 1.0 (límite crítico)\n`;
      explanation += `• Si λ > ${finalMu.toFixed(1)}, entonces ρ > 1.0 (sistema inestable)\n`;
      explanation += `• Si λ < ${finalMu.toFixed(1)}, entonces ρ < 1.0 (sistema estable)\n\n`;
      
      explanation += `📈 EVALUACIÓN DE CAPACIDAD:\n`;
      if (finalMu >= 0.5) {
        explanation += `✅ CAPACIDAD BUENA (μ ≥ 0.5):\n`;
        explanation += `El vendedor demuestra una capacidad de reposición sólida.\n`;
        explanation += `Puede manejar demanda moderada a alta sin problemas críticos.\n`;
        explanation += `Recomendación: Mantener el ritmo actual de reposiciones.\n`;
      } else if (finalMu >= 0.2) {
        explanation += `⚠️ CAPACIDAD MODERADA (0.2 ≤ μ < 0.5):\n`;
        explanation += `El vendedor tiene capacidad limitada pero aún funcional.\n`;
        explanation += `Puede manejar demanda ligera, pero riesgo con picos de demanda.\n`;
        explanation += `Recomendación: Considerar optimizar los procesos de reposición.\n`;
      } else {
        explanation += `� CAPACIDAD BAJA (μ < 0.2):\n`;
        explanation += `El vendedor necesita urgentemente mejorar su capacidad de reposición.\n`;
        explanation += `Alto riesgo de agotamientos frecuentes y pérdida de ventas.\n`;
        explanation += `Recomendación: Revisar y rediseñar el proceso de gestión de inventario.\n`;
      }
      
      explanation += `\n💼 IMPLICACIONES PARA EL NEGOCIO:\n`;
      explanation += `• Tiempo de reposición promedio: ${(1/finalMu).toFixed(1)} días\n`;
      explanation += `• Capacidad máxima diaria: ${finalMu.toFixed(2)} reposiciones\n`;
      explanation += `• Estabilidad del sistema: Depende de que λ < ${finalMu.toFixed(2)}\n`;
      explanation += `• Nivel de servicio: ${finalMu >= 0.5 ? 'Alto' : finalMu >= 0.2 ? 'Medio' : 'Bajo'}\n`;
      
      explanation += `\n🔬 NOTA METODOLÓGICA:\n`;
      explanation += `Este cálculo se basa en el historial real de reposiciones y agotamientos.\n`;
      explanation += `Los valores pueden cambiar conforme el vendedor modifique sus operaciones.\n`;
      explanation += `Se recomienda monitorear μ periódicamente para detectar tendencias.`;
      
      return {
        calculationMethod: 'Cálculo basado en historial de reposiciones',
        repositionsCount,
        depletionsCount,
        repositionDates,
        daysBetweenRepositions,
        averageDaysBetween: Number(averageDaysBetweenRepositions.toFixed(2)),
        rawMu: Number(rawMu.toFixed(4)),
        depletionPenalty: Number(depletionPenalty.toFixed(2)),
        finalMu: Number(finalMu.toFixed(4)),
        explanation
      };
    }

    // ✅ CASO 5: Producto con 1 reposición (usar estimación basada en tiempo desde creación)
    if (reposiciones.length === 1) {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        select: ['datePublication', 'stock']
      });

      if (product && product.datePublication) {
        const daysSinceCreation = (reposiciones[0].createdAt.getTime() - product.datePublication.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreation > 0) {
          let estimatedMu = 1 / daysSinceCreation;
          let finalMu = estimatedMu;
          let depletionPenalty = 1;
          let explanation = `📊 CASO DE UNA REPOSICIÓN ENCONTRADA

🔍 ANÁLISIS DE LA SITUACIÓN:
Solo se encontró 1 reposición en los últimos 30 días.
Para calcular μ usamos estimación basada en el ciclo de vida del producto.

📊 DATOS DEL SISTEMA:
• Período analizado: últimos 30 días
• Reposiciones encontradas: 1 evento
• Fecha de reposición: ${repositionDates[0]}
• Fecha de creación del producto: ${product.datePublication.toISOString().split('T')[0]}
• Agotamientos detectados: ${depletionsCount} eventos

🎓 METODOLOGÍA DE ESTIMACIÓN:
Con solo 1 reposición, no podemos calcular intervalos entre reposiciones.
En su lugar, usamos el tiempo desde la creación del producto hasta la primera reposición.

⏱️ CÁLCULO DEL PERÍODO:
Días desde creación hasta reposición: ${daysSinceCreation.toFixed(2)} días

Este período representa el tiempo que tomó al vendedor realizar la primera reposición
después de que el producto fue publicado en el sistema.

🧮 APLICACIÓN DE LA FÓRMULA:
μ_estimado = 1 ÷ tiempo_hasta_primera_reposición
μ_estimado = 1 ÷ ${daysSinceCreation.toFixed(2)} días = ${estimatedMu.toFixed(4)} reposiciones/día

📏 INTERPRETACIÓN DEL RESULTADO:
μ = ${estimatedMu.toFixed(4)} significa que el vendedor repone stock cada ${(1/estimatedMu).toFixed(1)} días aproximadamente.

⚠️ LIMITACIONES DE LA ESTIMACIÓN:
• Solo se basa en 1 punto de datos
• Puede no reflejar el patrón real de reposición
• Requiere validación con más datos en el futuro
• Es una aproximación conservadora`;
            // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS
          if (agotamientos.length > 0) {
            depletionPenalty = 1 - (agotamientos.length * 0.3);
            depletionPenalty = Math.max(0.1, depletionPenalty);
            finalMu = estimatedMu * depletionPenalty;
            explanation += `\n\n🔴 CORRECCIÓN POR AGOTAMIENTOS:
Se detectaron ${depletionsCount} agotamiento(s) en el período.
Esto indica que la capacidad estimada debe ajustarse a la baja.

📉 CÁLCULO DEL FACTOR DE PENALIZACIÓN:
Factor = 1 - (número_agotamientos × 0.3)
Factor = 1 - (${depletionsCount} × 0.3) = ${depletionPenalty.toFixed(2)}

🎯 μ CORREGIDO:
μ_final = μ_estimado × factor_penalización
μ_final = ${estimatedMu.toFixed(4)} × ${depletionPenalty.toFixed(2)} = ${finalMu.toFixed(4)} reposiciones/día

⚠️ SIGNIFICADO DE LA CORRECCIÓN:
Los agotamientos indican que la estimación original era optimista.
La capacidad real de servicio es menor debido a problemas operativos.`;
          } else {
            explanation += `\n\n✅ SIN CORRECCIONES:
No se detectaron agotamientos, por lo que la estimación se mantiene sin ajustes.
μ_final = ${estimatedMu.toFixed(4)} reposiciones/día`;
          }
          
          explanation += `\n\n🎯 EVALUACIÓN FINAL:
• Capacidad estimada: ${finalMu.toFixed(4)} reposiciones/día
• Frecuencia de reposición: cada ${(1/finalMu).toFixed(1)} días
• Confiabilidad: Media (basada en 1 punto de datos)
• Recomendación: Monitorear futuras reposiciones para validar estimación

💡 MEJORAS FUTURAS:
Con más reposiciones se podrá calcular μ de forma más precisa
usando intervalos reales entre reposiciones.

🔬 NOTA METODOLÓGICA:
Esta estimación es provisional y mejorará automáticamente
conforme se registren más eventos de reposición en el sistema.`;
          
          return {
            calculationMethod: 'Estimación desde creación del producto',
            repositionsCount,
            depletionsCount,
            repositionDates,
            daysBetweenRepositions: [Number(daysSinceCreation.toFixed(2))],
            averageDaysBetween: Number(daysSinceCreation.toFixed(2)),
            rawMu: Number(estimatedMu.toFixed(4)),
            depletionPenalty: Number(depletionPenalty.toFixed(2)),
            finalMu: Number(finalMu.toFixed(4)),
            explanation
          };
        }
      }
    }

    // ✅ CASO 6: Producto sin reposiciones pero con stock actual > 0 (producto nuevo o estable)
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['datePublication', 'stock']
    });

    if (product && product.stock > 0) {
      const daysSinceCreation = (new Date().getTime() - product.datePublication.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation >= 7) {
        let conservativeEstimate = 1 / daysSinceCreation;
        let finalMu = conservativeEstimate;
        let depletionPenalty = 1;
        let explanation = `🆕 PRODUCTO SIN REPOSICIONES:\n`;
        explanation += `📅 Fecha de creación: ${product.datePublication.toISOString().split('T')[0]}\n`;
        explanation += `⏱️ Días de vida: ${daysSinceCreation.toFixed(1)} días\n`;
        explanation += `📦 Stock actual: ${product.stock} unidades\n`;
        explanation += `🧮 μ conservador: 1 ÷ ${daysSinceCreation.toFixed(1)} = ${conservativeEstimate.toFixed(4)} reposiciones/día\n`;
        explanation += `💡 Interpretación: Se asume que el producto ha sido "estable" desde su creación`;
        
        // ✅ AJUSTAR μ SI HAY AGOTAMIENTOS
        if (agotamientos.length > 0) {
          depletionPenalty = 1 - (agotamientos.length * 0.4);
          depletionPenalty = Math.max(0.05, depletionPenalty);
          finalMu = conservativeEstimate * depletionPenalty;
          explanation += `\n🔴 PENALIZACIÓN FUERTE: ${depletionsCount} agotamiento(s) en producto sin reposiciones`;
          explanation += `\n📉 Factor: 1 - (${depletionsCount} × 0.4) = ${depletionPenalty.toFixed(2)}`;
          explanation += `\n🎯 μ final: ${conservativeEstimate.toFixed(4)} × ${depletionPenalty.toFixed(2)} = ${finalMu.toFixed(4)}`;
        }
        
        return {
          calculationMethod: 'Estimación conservadora para producto estable',
          repositionsCount,
          depletionsCount,
          repositionDates,
          daysBetweenRepositions: [],
          averageDaysBetween: Number(daysSinceCreation.toFixed(1)),
          rawMu: Number(conservativeEstimate.toFixed(4)),
          depletionPenalty: Number(depletionPenalty.toFixed(2)),
          finalMu: Number(finalMu.toFixed(4)),
          explanation
        };
      }
    }

    // ✅ CASO 7: Producto muy nuevo (< 7 días) - usar valor por defecto conservador
    let finalMu = 1 / 30; // 0.033 reposiciones/día
    let explanation = `🐣 PRODUCTO MUY NUEVO:\n`;
    explanation += `⏱️ Menos de 7 días de vida\n`;
    explanation += `🧮 μ por defecto: 1 ÷ 30 = ${finalMu.toFixed(4)} reposiciones/día\n`;
    explanation += `💡 Se asume una reposición cada 30 días como estimación conservadora`;
    
    // Si hay agotamientos en un producto muy nuevo, es una señal muy mala
    if (agotamientos.length > 0) {
      finalMu = 0.05;
      explanation += `\n🚨 CRÍTICO: Producto nuevo con agotamientos - μ = 0.05 (muy baja)`;
    }
    
    return {
      calculationMethod: 'Valor por defecto para producto muy nuevo',
      repositionsCount,
      depletionsCount,
      repositionDates,
      daysBetweenRepositions: [],
      averageDaysBetween: 30,
      rawMu: Number((1/30).toFixed(4)),
      depletionPenalty: agotamientos.length > 0 ? 0.05 : 1,
      finalMu,
      explanation
    };
  }
  /**
   * Determina el estado de la cola basado en el factor de utilización
   * ✅ MEJORADO: Mejor manejo de casos edge
   */
  private determineQueueStatus(rho: number): 'ESTABLE' | 'ADVERTENCIA' | 'CRITICO' {
    // Manejar casos especiales
    if (rho === Infinity || rho >= 999) {
      return 'CRITICO';
    }
    
    // Casos normales
    if (rho >= 0.8) {
      return 'CRITICO';
    } else if (rho >= 0.5) {
      return 'ADVERTENCIA';
    } else {
      return 'ESTABLE';
    }
  }
  /**
   * Genera mensaje descriptivo del estado
   * ✅ MEJORADO: Mensajes más informativos y contextuales
   */
  private generateStatusMessage(rho: number, lambda: number, mu: number): string {
    // Casos especiales
    if (rho === Infinity || rho >= 999) {
      if (lambda === 0) {
        return `Sin actividad - Producto sin demanda ni historial de reposiciones.`;
      } else {
        return `CRÍTICO - Sin historial de reposiciones. Demanda: ${lambda.toFixed(2)} clicks/día.`;
      }
    }
    
    // Casos normales
    if (rho >= 0.8) {
      return `CRÍTICO - Demanda alta (${lambda.toFixed(2)}) supera capacidad (${mu.toFixed(4)}). Factor ρ = ${rho.toFixed(2)}`;
    } else if (rho >= 0.5) {
      return `ADVERTENCIA - Demanda moderada. Factor ρ = ${rho.toFixed(2)}. Monitorear tendencias.`;
    } else if (lambda === 0) {
      return `Sin demanda - Producto sin clicks en el período analizado.`;
    } else {
      return `ESTABLE - Demanda controlada (${lambda.toFixed(2)} clicks/día). Factor ρ = ${rho.toFixed(2)}`;
    }
  }
  /**
   * Actualiza las métricas de analytics para un producto
   */
  async updateProductAnalytics(productId: string): Promise<ProductAnalytics> {
    console.log('🧮 CALCULATING QUEUE METRICS for product:', productId);
    
    const metrics = await this.calculateQueueMetrics(productId);
    
    console.log('📊 QUEUE METRICS CALCULATED:', {
      productId,
      lambda: metrics.lambda,
      mu: metrics.mu,
      rho: metrics.rho,
      status: metrics.status,
      message: metrics.message
    });
    
    let analytics = await this.analyticsRepository.findOne({
      where: { product: { id: productId } }
    });

    if (!analytics) {
      console.log('📝 CREATING NEW ANALYTICS RECORD for product:', productId);
      // Crear nueva entrada de analytics
      analytics = this.analyticsRepository.create({
        product: { id: productId } as Product,
        arrivalRate: metrics.lambda,
        serviceRate: metrics.mu,
        utilizationFactor: metrics.rho,
        congestionStatus: metrics.status,
        lastCalculation: new Date()
      });
    } else {
      console.log('🔄 UPDATING EXISTING ANALYTICS RECORD for product:', productId);
      console.log('📊 BEFORE UPDATE:', {
        oldUtilizationFactor: analytics.utilizationFactor,
        oldCongestionStatus: analytics.congestionStatus
      });
      
      // Actualizar entrada existente
      analytics.arrivalRate = metrics.lambda;
      analytics.serviceRate = metrics.mu;
      analytics.utilizationFactor = metrics.rho;
      analytics.congestionStatus = metrics.status;
      analytics.lastCalculation = new Date();
      
      console.log('📊 AFTER UPDATE:', {
        newUtilizationFactor: analytics.utilizationFactor,
        newCongestionStatus: analytics.congestionStatus
      });
    }

    const savedAnalytics = await this.analyticsRepository.save(analytics);
    
    console.log('✅ ANALYTICS SAVED SUCCESSFULLY for product:', productId, {
      analyticsId: savedAnalytics.id,
      utilizationFactor: savedAnalytics.utilizationFactor,
      congestionStatus: savedAnalytics.congestionStatus
    });
    
    return savedAnalytics;
  }
  /**
   * Obtiene productos prioritarios basados en estado de congestión y factor de utilización
   * ✅ MEJORADO: Ordena primero por estado crítico, luego por factor de utilización
   */
  async getPriorityProducts(limit: number = 10): Promise<Product[]> {
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .leftJoinAndSelect('product.categories', 'categories')
      .where('product.stock >= 0') // Incluir productos con stock 0 también
      // Ordenar por prioridad real: CRITICO > ADVERTENCIA > ESTABLE, luego por factor de utilización
      .orderBy(`
        CASE 
          WHEN analytics.congestionStatus = 'CRITICO' THEN 1
          WHEN analytics.congestionStatus = 'ADVERTENCIA' THEN 2
          WHEN analytics.congestionStatus = 'ESTABLE' THEN 3
          ELSE 4
        END
      `, 'ASC')
      .addOrderBy('analytics.utilizationFactor', 'DESC')
      .limit(limit)
      .getMany();

    console.log(`📋 PRIORITY PRODUCTS QUERY RESULT: ${products.length} products found`);
    
    // Log para debugging
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}:`, {
        stock: product.stock,
        congestionStatus: product.analytics?.congestionStatus || 'NO_ANALYTICS',
        utilizationFactor: product.analytics?.utilizationFactor || 0
      });
    });

    return products;
  }

  /**
   * Obtiene productos que necesitan reposición urgente
   */
  async getCriticalProducts(): Promise<Product[]> {
    return await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .where('analytics.congestionStatus = :status', { status: 'CRITICO' })
      .orderBy('analytics.utilizationFactor', 'DESC')
      .getMany();
  }
  /**
   * ✅ NUEVO: Inicializa productos existentes sin historial de analytics
   * Crea registros de stock inicial como "reposición virtual" para productos que no tienen historial
   */
  async initializeProductWithoutHistory(productId: string): Promise<void> {
    // Verificar si ya tiene historial de stock
    const existingHistory = await this.stockRepository.findOne({
      where: { product: { id: productId } }
    });

    if (existingHistory) {
      console.log(`📊 Product ${productId} already has stock history, skipping initialization`);
      return;
    }

    // Obtener producto actual
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['id', 'stock', 'datePublication']
    });

    if (!product) {
      console.log(`❌ Product ${productId} not found for initialization`);
      return;
    }

    if (product.stock > 0) {
      console.log(`🔄 INITIALIZING product ${productId} with virtual stock history (current stock: ${product.stock})`);
      
      // Crear registro de "stock inicial" como reposición virtual
      const initialStockRecord = this.stockRepository.create({
        product: product, // Usar la instancia completa del producto
        previousStock: 0,
        newStock: product.stock,
        stockChange: product.stock,
        changeType: 'REPOSITION',
        notes: `Inicialización automática - Stock inicial del producto`,
        daysSinceLastReposition: 0,
        createdAt: product.datePublication || new Date()
      });

      await this.stockRepository.save(initialStockRecord);
      console.log(`✅ Virtual stock history created for product ${productId}`);
    }
  }

  /**
   * ✅ NUEVO: Inicializa todos los productos sin historial
   */
  async initializeAllProductsWithoutHistory(): Promise<{ initialized: number; skipped: number }> {
    console.log('🔄 STARTING BULK INITIALIZATION of products without history');
    
    // Obtener todos los productos
    const allProducts = await this.productRepository.find({
      select: ['id', 'stock', 'datePublication']
    });

    let initialized = 0;
    let skipped = 0;

    for (const product of allProducts) {
      try {
        const hasHistory = await this.stockRepository.findOne({
          where: { product: { id: product.id } }
        });

        if (!hasHistory && product.stock > 0) {
          await this.initializeProductWithoutHistory(product.id);
          initialized++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error initializing product ${product.id}:`, error);
        skipped++;
      }
    }

    console.log(`✅ BULK INITIALIZATION COMPLETED: ${initialized} initialized, ${skipped} skipped`);
    return { initialized, skipped };
  }
  /**
   * ✅ NUEVO: Asegura que todos los productos del vendedor tengan analytics inicializados
   */
  async ensureAnalyticsForAllProducts(vendorId: string): Promise<void> {
    console.log('🔄 ENSURING ANALYTICS FOR PRODUCTS:', vendorId === 'all' ? 'ALL PRODUCTS' : `VENDOR ${vendorId}`);
    
    // Construir query base
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.analytics', 'analytics')
      .where('analytics.id IS NULL');
    
    // Si no es 'all', filtrar por vendor
    if (vendorId !== 'all') {
      queryBuilder.andWhere('product.vendor = :vendorId', { vendorId });
    }
    
    const productsWithoutAnalytics = await queryBuilder.getMany();

    console.log(`📊 FOUND ${productsWithoutAnalytics.length} PRODUCTS WITHOUT ANALYTICS`);

    // Crear analytics para cada producto sin analytics
    for (const product of productsWithoutAnalytics) {
      console.log(`📝 CREATING ANALYTICS for product: ${product.title} (${product.id})`);
      
      const analytics = this.analyticsRepository.create({
        product: { id: product.id } as Product,
        totalClicks: 0,
        totalViews: 0,
        totalSearches: 0,
        arrivalRate: 0,
        serviceRate: 0.1, // Valor por defecto bajo
        utilizationFactor: 0,
        congestionStatus: 'ESTABLE',
        lastCalculation: new Date()
      });

      await this.analyticsRepository.save(analytics);
      
      // Intentar calcular métricas reales si es posible
      try {
        await this.updateProductAnalytics(product.id);
        console.log(`✅ ANALYTICS CALCULATED for product: ${product.title}`);
      } catch (error) {
        console.log(`⚠️ COULD NOT CALCULATE ANALYTICS for product: ${product.title}`, error.message);
      }
    }
  }
}
