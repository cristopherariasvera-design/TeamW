import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function cleanFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return `${String(date.getDate()).padStart(2, '0')}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}-${date.getFullYear()}`;
}

function getMonthLabel(year: number, monthIndex: number) {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function getMonthsBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    months.push({
      year: cursor.getFullYear(),
      monthIndex: cursor.getMonth(),
      label: getMonthLabel(cursor.getFullYear(), cursor.getMonth()),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function getWeekOfMonth(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function extractBlocks(sections: any) {
  if (!sections) return '';

  try {
    if (typeof sections === 'string') return sections;

    if (Array.isArray(sections)) {
      return sections
        .map((section) => {
          if (typeof section === 'string') return section;
          return section.title || section.name || section.type || JSON.stringify(section);
        })
        .join(' | ');
    }

    if (typeof sections === 'object') {
      return JSON.stringify(sections);
    }

    return '';
  } catch {
    return '';
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const {
      student_id,
      period_start,
      period_end,
      send_to_email,
    } = body;

    if (!student_id) {
      throw new Error('Falta student_id.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select('id, full_name, email, coach_id')
      .eq('id', student_id)
      .single();

    if (studentError) throw studentError;
    if (!student) throw new Error('Alumno no encontrado.');

    let finalPeriodStart = period_start;
    let finalPeriodEnd = period_end;
    let sessionsPerWeek = 3;
    let periodId = null;

    if (!finalPeriodStart || !finalPeriodEnd) {
      const { data: period, error: periodError } = await supabase
        .from('student_plan_periods')
        .select('*')
        .eq('student_id', student_id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (periodError) throw periodError;

      if (!period) {
        throw new Error('El alumno no tiene período registrado.');
      }

      periodId = period.id;
      finalPeriodStart = period.start_date;
      finalPeriodEnd = period.end_date;
      sessionsPerWeek = period.sessions_per_week || 3;
    }

    const { data: coach } = student.coach_id
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', student.coach_id)
          .maybeSingle()
      : { data: null };

    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id, title, date, sections, is_done, created_at')
      .eq('student_id', student_id)
      .gte('date', finalPeriodStart)
      .lte('date', finalPeriodEnd)
      .order('date', { ascending: true });

    if (plansError) throw plansError;

    const months = getMonthsBetween(finalPeriodStart, finalPeriodEnd);

    const workbook = XLSX.utils.book_new();

    const totalExpectedWeeks = Math.ceil(
      (new Date(`${finalPeriodEnd}T00:00:00`).getTime() -
        new Date(`${finalPeriodStart}T00:00:00`).getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );

    const expectedTotal = totalExpectedWeeks * sessionsPerWeek;
    const loadedTotal = plans?.length || 0;
    const completedTotal = plans?.filter((plan) => plan.is_done).length || 0;

    const resumenRows = [
      ['TEAMW - REPORTE DE PLANIFICACIÓN'],
      [],
      ['Alumno', student.full_name || 'Sin nombre'],
      ['Correo alumno', student.email || 'Sin correo'],
      ['Coach', coach?.full_name || 'Sin coach asignado'],
      ['Correo coach', coach?.email || ''],
      ['Período', `${formatDate(finalPeriodStart)} al ${formatDate(finalPeriodEnd)}`],
      ['Sesiones por semana', sessionsPerWeek],
      ['WODs esperados', expectedTotal],
      ['WODs cargados', loadedTotal],
      ['WODs completados', completedTotal],
      ['WODs pendientes por cargar', Math.max(expectedTotal - loadedTotal, 0)],
      [
        'Cumplimiento',
        expectedTotal > 0
          ? `${Math.round((completedTotal / expectedTotal) * 100)}%`
          : '0%',
      ],
      [],
      ['Meses incluidos'],
      ...months.map((month) => [month.label]),
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenRows);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    months.forEach((month) => {
      const monthPlans =
        plans?.filter((plan) => {
          const planDate = new Date(`${plan.date}T00:00:00`);
          return (
            planDate.getFullYear() === month.year &&
            planDate.getMonth() === month.monthIndex
          );
        }) || [];

      const rows: any[][] = [
        [`${month.label.toUpperCase()} - ${student.full_name || 'Alumno'}`],
        [],
        [
          'Semana',
          'Fecha',
          'Día',
          'WOD',
          'Bloques',
          'Estado',
          'Feedback',
        ],
      ];

      for (let week = 1; week <= 5; week++) {
        const weekPlans = monthPlans.filter(
          (plan) => getWeekOfMonth(plan.date) === week
        );

        rows.push([]);
        rows.push([`Semana ${week}`]);

        weekPlans.forEach((plan) => {
          const date = new Date(`${plan.date}T00:00:00`);

          rows.push([
            `Semana ${week}`,
            formatDate(plan.date),
            DAY_NAMES[date.getDay()],
            plan.title || 'WOD sin título',
            extractBlocks(plan.sections),
            plan.is_done ? 'Completado' : 'Cargado',
            '',
          ]);
        });

        const missing = Math.max(sessionsPerWeek - weekPlans.length, 0);

        for (let i = 0; i < missing; i++) {
          rows.push([
            `Semana ${week}`,
            '',
            '',
            'Pendiente',
            '',
            'Por cargar',
            '',
          ]);
        }
      }

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, month.label.substring(0, 31));
    });

    const excelArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const excelBytes = new Uint8Array(excelArrayBuffer);

    const studentName = cleanFileName(student.full_name || 'Alumno');
    const startLabel = finalPeriodStart.substring(0, 7);
    const endLabel = finalPeriodEnd.substring(0, 7);

    const fileName = `Reporte_${studentName}_${startLabel}_a_${endLabel}.xlsx`;
    const storagePath = `students/${student.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('teamw-reports')
      .upload(storagePath, excelBytes, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('teamw-reports')
      .getPublicUrl(storagePath);

    const fileUrl = publicUrlData.publicUrl;

    const { error: reportError } = await supabase
      .from('student_reports')
      .insert({
        student_id: student.id,
        coach_id: student.coach_id || null,
        period_start: finalPeriodStart,
        period_end: finalPeriodEnd,
        months: months.map((month) => month.label),
        file_name: fileName,
        storage_bucket: 'teamw-reports',
        storage_path: storagePath,
        file_url: fileUrl,
        sent_to_email: send_to_email || student.email || null,
        sent_at: null,
        status: 'generated',
      });

    if (reportError) throw reportError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reporte generado correctamente.',
        file_name: fileName,
        file_url: fileUrl,
        storage_path: storagePath,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
    } catch (error: unknown) {
    console.error('generate-student-report error:', error);

    const message =
        error instanceof Error
        ? error.message
        : 'Error generando reporte.';

    return new Response(
        JSON.stringify({
        success: false,
        error: message,
        }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});