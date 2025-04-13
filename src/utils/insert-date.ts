export function insertDateRegistration(): Date {
  // Obtener la fecha actual
  const fechaActual = new Date();

  // Configurar la fecha en la zona horaria de Bolivia (UTC-4)
  // Forma sencilla usando toLocaleString con la zona horaria
  const boliviaTimeStr = fechaActual.toLocaleString('en-US', {
    timeZone: 'America/La_Paz',
  });

  // Crear una nueva fecha a partir del string en zona horaria de Bolivia
  const boliviaDate = new Date(boliviaTimeStr);

  // Asignar la fecha a la propiedad fechaRegistro
  return boliviaDate;
}
