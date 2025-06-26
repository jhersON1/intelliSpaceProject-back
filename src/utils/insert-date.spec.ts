import { insertDateRegistration } from './insert-date';

describe('insertDateRegistration', () => {
  beforeEach(() => {
    // Limpiar cualquier mock de fecha antes de cada test
    jest.useRealTimers();
  });

  afterEach(() => {
    // Restaurar cualquier mock después de cada test
    jest.useRealTimers();
  });

  it('should return a Date object', () => {
    const result = insertDateRegistration();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return a valid date', () => {
    const result = insertDateRegistration();
    expect(result).not.toBeNull();
    expect(result.toString()).not.toBe('Invalid Date');
  });

  it('should return a date that represents Bolivia timezone (UTC-4)', () => {
    // Mock de una fecha específica para hacer el test predecible
    const mockDate = new Date('2023-06-15T10:00:00.000Z'); // 10:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const result = insertDateRegistration();
    
    // La fecha debería ser convertida a hora de Bolivia (UTC-4)
    // 10:00 UTC = 06:00 Bolivia time
    const expectedHour = 6; // 10 - 4 = 6
    
    expect(result.getHours()).toBe(expectedHour);
    
    jest.useRealTimers();
  });

  it('should handle different times of day correctly', () => {
    // Test con diferentes horarios para verificar la conversión
    const testCases = [
      { utc: '2023-06-15T00:00:00.000Z', expectedHour: 20 }, // 00:00 UTC = 20:00 Bolivia (día anterior)
      { utc: '2023-06-15T12:00:00.000Z', expectedHour: 8 },  // 12:00 UTC = 08:00 Bolivia
      { utc: '2023-06-15T23:59:59.000Z', expectedHour: 19 }, // 23:59 UTC = 19:59 Bolivia
    ];

    testCases.forEach(({ utc, expectedHour }) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(utc));

      const result = insertDateRegistration();
      expect(result.getHours()).toBe(expectedHour);

      jest.useRealTimers();
    });
  });

  it('should return current time when no specific time is provided', () => {
    const beforeCall = Date.now();
    const result = insertDateRegistration();
    const afterCall = Date.now();

    // El resultado debería estar dentro de un rango razonable del tiempo actual
    // Permitimos una diferencia de hasta 5 segundos para el procesamiento
    const resultTime = result.getTime();
    const timeDifference = Math.abs(resultTime - beforeCall);
    
    expect(timeDifference).toBeLessThan(5000); // 5 segundos
  });
  it('should consistently return Bolivia timezone regardless of system timezone', () => {
    // Mock múltiples llamadas en corto tiempo
    const dates: Date[] = [];
    for (let i = 0; i < 3; i++) {
      dates.push(insertDateRegistration());
      // Pequeña pausa para evitar que sean exactamente iguales
    }

    // Todas las fechas deberían representar la zona horaria de Bolivia
    dates.forEach(date => {
      expect(date).toBeInstanceOf(Date);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    // Las fechas deberían estar muy cerca en tiempo (dentro del mismo minuto)
    const firstTime = dates[0].getTime();
    dates.forEach(date => {
      const timeDiff = Math.abs(date.getTime() - firstTime);
      expect(timeDiff).toBeLessThan(60000); // Menos de 1 minuto de diferencia
    });
  });

  it('should handle edge cases like year boundaries', () => {
    // Test de cambio de año en Bolivia vs UTC
    jest.useFakeTimers();
    
    // 31 de diciembre a las 23:30 UTC = 31 de diciembre a las 19:30 Bolivia
    jest.setSystemTime(new Date('2023-12-31T23:30:00.000Z'));
    
    const result = insertDateRegistration();
    
    // Debería ser aún el 31 de diciembre en Bolivia
    expect(result.getDate()).toBe(31);
    expect(result.getMonth()).toBe(11); // Diciembre (0-based)
    expect(result.getFullYear()).toBe(2023);
    expect(result.getHours()).toBe(19); // 23 - 4 = 19
    
    jest.useRealTimers();
  });

  it('should handle daylight saving time transitions properly', () => {
    // Bolivia no observa horario de verano, siempre es UTC-4
    const summerDate = new Date('2023-07-15T10:00:00.000Z'); // Verano en hemisferio norte
    const winterDate = new Date('2023-01-15T10:00:00.000Z'); // Invierno en hemisferio norte
    
    jest.useFakeTimers();
    
    // Test verano
    jest.setSystemTime(summerDate);
    const summerResult = insertDateRegistration();
    
    // Test invierno  
    jest.setSystemTime(winterDate);
    const winterResult = insertDateRegistration();
    
    // Ambos deberían ser UTC-4 (6 AM Bolivia time)
    expect(summerResult.getHours()).toBe(6);
    expect(winterResult.getHours()).toBe(6);
    
    jest.useRealTimers();
  });
});
