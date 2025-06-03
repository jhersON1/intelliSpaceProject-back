# 📊 Teoría de Colas M/M/1 - IntelliSpace Marketplace

Este documento explica la implementación del modelo de Teoría de Colas M/M/1 en el marketplace de muebles IntelliSpace.

## 🎯 Objetivo

Optimizar la gestión de inventario y priorización de productos mediante el análisis matemático de la demanda (clicks) vs. capacidad de reposición del vendedor.

## 📐 Fundamento Matemático

### Modelo M/M/1
- **M/M/1**: Sistema de cola con arribos Poisson y servicio exponencial con un servidor
- **λ (Lambda)**: Tasa de llegadas (clicks por día)
- **μ (Mu)**: Tasa de servicio (reposiciones por día) 
- **ρ (Rho)**: Factor de utilización = λ/μ

### Fórmulas Implementadas

```
λ = Total_Clicks / Período_Días
μ = 1 / Tiempo_Promedio_Entre_Reposiciones  
ρ = λ / μ
```

### Algoritmo de Detección de Congestión

```
SI ρ ≥ 0.8 ENTONCES → CRÍTICO - Reponer urgentemente
SI 0.5 ≤ ρ < 0.8 ENTONCES → ADVERTENCIA - Monitorear demanda  
SI ρ < 0.5 ENTONCES → ESTABLE - Demanda controlada
```

## 🏗️ Arquitectura de la Implementación

### Entidades de Base de Datos

#### 1. ProductAnalytics
- Almacena métricas calculadas (λ, μ, ρ)
- Estado de congestión del producto
- Contadores de interacciones

#### 2. ClickTracking  
- Registra cada click/vista de usuario
- IP, User-Agent, tipo de interacción
- Duración de la visita

#### 3. StockHistory
- Historial de cambios de inventario
- Tipo de cambio (REPOSITION, SALE, DEPLETION)
- Días entre reposiciones

### Servicios

#### QueueTheoryService
- **calculateQueueMetrics()**: Calcula λ, μ, ρ para un producto
- **updateProductAnalytics()**: Actualiza métricas en base de datos
- **getPriorityProducts()**: Productos ordenados por ρ
- **getCriticalProducts()**: Productos que necesitan reposición urgente

#### AnalyticsService  
- **trackProductInteraction()**: Registra clicks/vistas
- **trackStockChange()**: Registra cambios de inventario
- **getProductStats()**: Estadísticas completas de un producto
- **getVendorDashboard()**: Dashboard para vendedores

## 🚀 Endpoints de la API

### Analytics Core
```http
POST   /analytics/track-click          # Registrar click manual
POST   /analytics/track-stock          # Registrar cambio de stock  
GET    /analytics/product/:id/stats    # Estadísticas del producto
GET    /analytics/product/:id/queue-metrics  # Métricas M/M/1
```

### Queue Theory
```http
GET    /analytics/priority-products    # Productos prioritarios por ρ
GET    /analytics/critical-products    # Productos críticos (ρ ≥ 0.8)
GET    /analytics/vendor-dashboard     # Dashboard del vendedor
POST   /analytics/recalculate-metrics  # Recalcular todas las métricas
```

### Products Enhanced
```http
GET    /products/intelligent-search    # Búsqueda ordenada por teoría de colas
GET    /products/:id                   # Auto-tracking de vistas habilitado
```

## 🔧 Uso Práctico

### Tracking Automático
- **Clicks**: Se registran automáticamente al visitar `/products/:id`
- **Stock**: Se registran automáticamente al actualizar un producto
- **Métricas**: Se recalculan automáticamente en cambios importantes

### Ejemplo de Uso

```typescript
// 1. Obtener métricas de un producto
const metrics = await queueTheoryService.calculateQueueMetrics(productId);
console.log(`Factor de utilización: ${metrics.rho}`);
console.log(`Estado: ${metrics.status}`);

// 2. Obtener productos críticos
const criticalProducts = await queueTheoryService.getCriticalProducts();

// 3. Búsqueda inteligente (ordenada por demanda)
const products = await productsService.findAllWithQueuePriority(pagination);
```

### Dashboard del Vendedor

```json
{
  "totalProducts": 25,
  "criticalProducts": 3,
  "warningProducts": 7, 
  "stableProducts": 15,
  "topProducts": [
    {
      "id": "uuid",
      "title": "Mesa de roble",
      "utilizationFactor": 18.6,
      "congestionStatus": "CRITICO",
      "totalClicks": 240
    }
  ]
}
```

## 🎮 Demo y Pruebas

### Ejecutar Demo
```bash
# Compilar y ejecutar demo
npm run build
node dist/analytics/demo/queue-theory-demo.js
```

### Caso de Estudio: "Muebles Don Carlos"
La demo incluye el ejemplo exacto del documento:
- 240 clicks en 30 días (λ = 8.0 clicks/día)
- Reposiciones cada 2-3 días (μ = 0.43 reposiciones/día)
- Factor ρ = 18.6 → Estado CRÍTICO

## 🔮 Beneficios Implementados

### Para el Usuario
- **Búsqueda Inteligente**: Productos con alta demanda aparecen primero
- **Disponibilidad Real**: Solo se muestran productos en stock
- **Experiencia Optimizada**: Menos productos agotados

### Para el Vendedor  
- **Alertas Automáticas**: Notificaciones cuando ρ ≥ 0.8
- **Dashboard Analítico**: Métricas de rendimiento en tiempo real
- **Optimización de Inventario**: Decisiones basadas en demanda real

### Para el Sistema
- **Gestión Predictiva**: Identificación temprana de problemas
- **Optimización de Recursos**: Priorización automática
- **Métricas Científicas**: Decisiones basadas en modelos matemáticos

## 📈 Métricas de Éxito

1. **Reducción de productos agotados mostrados**: < 5%
2. **Mejora en conversión**: Productos prioritarios tienen mayor conversión
3. **Optimización de inventario**: Vendedores reponen antes del agotamiento
4. **Satisfacción del usuario**: Menor frustración por productos no disponibles

## 🔧 Configuración Avanzada

### Parámetros Ajustables
- **Período de análisis**: Por defecto 30 días
- **Umbrales de congestión**: ρ = 0.5 y 0.8
- **Límites de consulta**: Productos por página

### Personalización por Categoría
El sistema permite ajustar umbrales específicos por categoría de producto.

---

**Implementado con ❤️ usando NestJS + TypeORM + PostgreSQL**
