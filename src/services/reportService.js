import { supabase } from '../config/supabaseClient';

export async function generateStudentReport({
  studentId,
  periodStart,
  periodEnd,
  sendToEmail,
}) {
  try {
    if (!studentId) {
      throw new Error('Falta studentId para generar el reporte.');
    }

    const { data, error } = await supabase.functions.invoke(
      'generate-student-report',
      {
        body: {
          student_id: studentId,
          period_start: periodStart || null,
          period_end: periodEnd || null,
          send_to_email: sendToEmail || null,
        },
      }
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.error || 'No se pudo generar el reporte.');
    }

    return data;
  } catch (error) {
    console.error('Error generateStudentReport:', error.message || error);
    throw error;
  }
}