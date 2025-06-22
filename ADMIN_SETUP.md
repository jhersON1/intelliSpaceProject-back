# Crear Usuario Admin - Ejemplo para Postman

## POST {{baseUrl}}/auth/register

### Headers:
```
Content-Type: application/json
```

### Body (JSON):
```json
{
  "email": "admin@intellispace.com",
  "password": "Admin123456!",
  "name": "Sistema",
  "lastname": "Administrador",
  "rol": "ADMIN"
}
```

### Respuesta esperada:
```json
{
  "user": {
    "id": "uuid-del-admin",
    "email": "admin@intellispace.com",
    "name": "Sistema",
    "lastname": "Administrador",
    "rol": "ADMIN"
  },
  "token": "jwt-token-aqui"
}
```

## Endpoints de Admin disponibles:

### 1. Obtener logs del sistema
```
GET {{baseUrl}}/admin/logs
Authorization: Bearer {{adminToken}}

Query parameters opcionales:
- level: ERROR | WARN
- startDate: 2025-06-22T00:00:00Z
- endDate: 2025-06-22T23:59:59Z
- limit: 50
- offset: 0
```

### 2. Obtener estadísticas del dashboard
```
GET {{baseUrl}}/admin/dashboard/stats
Authorization: Bearer {{adminToken}}
```

### 3. Marcar log como resuelto
```
PATCH {{baseUrl}}/admin/logs/{logId}/resolve
Authorization: Bearer {{adminToken}}
```

## Variables de entorno para Postman:
```
baseUrl: http://localhost:3500
adminToken: (token obtenido al crear/loguear admin)
```
