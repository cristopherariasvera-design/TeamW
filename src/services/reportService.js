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

    if (error) {
      let backendMessage = error.message || 'Error ejecutando Edge Function.';

      if (error.context) {
        try {
          const errorBody = await error.context.json();

          backendMessage =
            errorBody?.error ||
            errorBody?.message ||
            backendMessage;
        } catch {
          // Mantiene mensaje original
        }
      }

      throw new Error(backendMessage);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'No se pudo generar el reporte.');
    }

    return data;
  } catch (error) {
    console.error('Error generateStudentReport:', error.message || error);
    throw error;
  }
}

export async function getStudentReports(studentId) {
  try {
    if (!studentId) {
      throw new Error('Falta studentId para consultar reportes.');
    }

    const { data, error } = await supabase
      .from('student_reports')
      .select(`
        id,
        student_id,
        coach_id,
        period_start,
        period_end,
        months,
        file_name,
        file_url,
        storage_path,
        sent_to_email,
        sent_at,
        status,
        created_at
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getStudentReports:', error.message || error);
    throw error;
  }
}