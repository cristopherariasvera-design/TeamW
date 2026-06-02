export async function getChileHolidays(year) {
  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/CL`
    );

    if (!response.ok) {
      throw new Error('Error obteniendo feriados');
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('HolidayService:', error);
    return [];
  }
}