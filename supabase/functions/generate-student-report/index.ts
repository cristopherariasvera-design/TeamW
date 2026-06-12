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

type MonthInfo = {
  year: number;
  monthIndex: number;
  label: string;
};

type PlanItem = {
  id: string;
  title: string | null;
  date: string;
  sections: unknown;
  is_done: boolean | null;
};

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

function getMonthsBetween(startDate: string, endDate: string): MonthInfo[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const months: MonthInfo[] = [];
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

function getWeeksBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, Math.ceil(diffDays / 7));
}

function extractBlocks(sections: unknown) {
  if (!sections) return '';

  try {
    if (typeof sections === 'string') return sections;

    if (Array.isArray(sections)) {
      return sections
        .map((section) => {
          if (typeof section === 'string') return section;

          if (section && typeof section === 'object' && 'title' in section) {
            return String(section.title || '');
          }

          if (section && typeof section === 'object' && 'name' in section) {
            return String(section.name || '');
          }

          if (section && typeof section === 'object' && 'type' in section) {
            return String(section.type || '');
          }

          return JSON.stringify(section);
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function textToBase64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);

  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${textToBase64(value)}?=`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function getGmailAccessToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Faltan secrets de Gmail: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN.'
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error_description ||
        result?.error ||
        'No se pudo obtener access token de Gmail.'
    );
  }

  if (!result.access_token) {
    throw new Error('Google no devolvió access_token.');
  }

  return result.access_token as string;
}

async function sendGmailWithAttachment({
  to,
  subject,
  html,
  fileName,
  fileBytes,
}: {
  to: string;
  subject: string;
  html: string;
  fileName: string;
  fileBytes: Uint8Array;
}) {
  const fromEmail = Deno.env.get('GMAIL_FROM_EMAIL');

  if (!fromEmail) {
    throw new Error('Falta secret GMAIL_FROM_EMAIL.');
  }

  const accessToken = await getGmailAccessToken();
  const boundary = `teamw_boundary_${crypto.randomUUID()}`;

  const htmlBase64 = wrapBase64(textToBase64(html));
  const attachmentBase64 = wrapBase64(bytesToBase64(fileBytes));

  const mimeMessage = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
    '',
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    attachmentBase64,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const raw = base64UrlEncode(mimeMessage);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        result?.error_description ||
        'No se pudo enviar el correo por Gmail.'
    );
  }

  return result;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { student_id, period_start, period_end, send_to_email } = body;

    if (!student_id) {
      throw new Error('Falta student_id.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      throw new Error('No autorizado. Debes iniciar sesión.');
    }

    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Sesión inválida o expirada.');
    }

    const { data: currentProfile, error: currentProfileError } =
      await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single();

    if (currentProfileError) throw currentProfileError;

    if (!currentProfile) {
      throw new Error('No se encontró el perfil del usuario actual.');
    }

    const isAdmin = currentProfile.role === 'admin';
    const isCoach = currentProfile.role === 'coach';

    if (!isAdmin && !isCoach) {
      throw new Error('No tienes permisos para generar reportes.');
    }

    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        coach_id,
        sessions_per_week,
        plan_weeks
      `)
      .eq('id', student_id)
      .single();

    if (studentError) throw studentError;

    if (!student) {
      throw new Error('Alumno no encontrado.');
    }

    if (isCoach && student.coach_id !== currentProfile.id) {
      throw new Error(
        'Solo puedes generar reportes de tus alumnos asignados.'
      );
    }

    let finalPeriodStart = period_start;
    let finalPeriodEnd = period_end;
    let sessionsPerWeek = Number(student.sessions_per_week || 0) || 3;
    let configuredWeeks = Number(student.plan_weeks || 0) || 0;

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

      finalPeriodStart = period.start_date;
      finalPeriodEnd = period.end_date;

      sessionsPerWeek =
        Number(period.sessions_per_week || 0) ||
        Number(student.sessions_per_week || 0) ||
        3;

      configuredWeeks =
        Number(period.plan_weeks || period.weeks || 0) ||
        Number(student.plan_weeks || 0) ||
        0;
    }

    if (!finalPeriodStart || !finalPeriodEnd) {
      throw new Error('El período no tiene fecha de inicio o término.');
    }

    const { data: coach, error: coachError } = student.coach_id
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', student.coach_id)
          .maybeSingle()
      : { data: null, error: null };

    if (coachError) throw coachError;

    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id, title, date, sections, is_done')
      .eq('student_id', student_id)
      .gte('date', finalPeriodStart)
      .lte('date', finalPeriodEnd)
      .order('date', { ascending: true });

    if (plansError) throw plansError;

    const planRows = (plans || []) as PlanItem[];
    const months = getMonthsBetween(finalPeriodStart, finalPeriodEnd);

    const workbook = XLSX.utils.book_new();

    const totalExpectedWeeks =
      configuredWeeks || getWeeksBetween(finalPeriodStart, finalPeriodEnd);

    const expectedTotal = totalExpectedWeeks * sessionsPerWeek;
    const loadedTotal = planRows.length;
    const completedTotal = planRows.filter((plan) => plan.is_done).length;

    const resumenRows = [
      ['TEAMW - REPORTE DE PLANIFICACIÓN'],
      [],
      ['Alumno', student.full_name || 'Sin nombre'],
      ['Correo alumno', student.email || 'Sin correo'],
      ['Coach', coach?.full_name || 'Sin coach asignado'],
      ['Correo coach', coach?.email || ''],
      [
        'Período',
        `${formatDate(finalPeriodStart)} al ${formatDate(finalPeriodEnd)}`,
      ],
      ['Sesiones por semana', sessionsPerWeek],
      ['Semanas del período', totalExpectedWeeks],
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
      ['Generado por', currentProfile.full_name || currentProfile.email || ''],
      ['Rol', currentProfile.role],
      [],
      ['Meses incluidos'],
      ...months.map((month) => [month.label]),
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenRows);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    months.forEach((month) => {
      const monthPlans = planRows.filter((plan) => {
        const planDate = new Date(`${plan.date}T00:00:00`);

        return (
          planDate.getFullYear() === month.year &&
          planDate.getMonth() === month.monthIndex
        );
      });

      const rows: unknown[][] = [
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
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        month.label.substring(0, 31)
      );
    });

    const excelArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    }) as ArrayBuffer;

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
    const recipientEmail = send_to_email || student.email || null;

    let emailSent = false;
    let emailErrorMessage: string | null = null;
    let sentAt: string | null = null;

    if (recipientEmail) {
      try {
        const emailSubject = `Reporte TeamW - ${
          student.full_name || 'Alumno'
        } - ${startLabel} a ${endLabel}`;

        const html = `
          <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
            <h2 style="color: #111;">Reporte TeamW</h2>

            <p>Hola <strong>${escapeHtml(student.full_name || 'Alumno')}</strong>,</p>

            <p>
              Te compartimos tu reporte TeamW correspondiente al período
              <strong>${escapeHtml(formatDate(finalPeriodStart))}</strong> al
              <strong>${escapeHtml(formatDate(finalPeriodEnd))}</strong>.
            </p>

            <p>
              El archivo Excel viene adjunto en este correo.
              También puedes descargarlo desde el siguiente enlace:
            </p>

            <p>
              <a href="${escapeHtml(fileUrl)}" target="_blank">
                Descargar reporte Excel
              </a>
            </p>

            <hr />

            <p style="font-size: 12px; color: #555;">
              Este correo fue generado automáticamente por TeamW.
            </p>
          </div>
        `;

        await sendGmailWithAttachment({
          to: recipientEmail,
          subject: emailSubject,
          html,
          fileName,
          fileBytes: excelBytes,
        });

        emailSent = true;
        sentAt = new Date().toISOString();
      } catch (emailError: unknown) {
        console.error('Gmail send error:', emailError);

        if (emailError instanceof Error) {
          emailErrorMessage = emailError.message;
        } else if (typeof emailError === 'string') {
          emailErrorMessage = emailError;
        } else {
          emailErrorMessage = JSON.stringify(emailError);
        }
      }
    }

    const status = recipientEmail
      ? emailSent
        ? 'sent'
        : 'email_error'
      : 'generated';

    const { error: reportError } = await supabase
      .from('student_reports')
      .upsert(
        {
          student_id: student.id,
          coach_id: student.coach_id || null,
          period_start: finalPeriodStart,
          period_end: finalPeriodEnd,
          months: months.map((month) => month.label),
          file_name: fileName,
          storage_bucket: 'teamw-reports',
          storage_path: storagePath,
          file_url: fileUrl,
          sent_to_email: recipientEmail,
          sent_at: sentAt,
          status,
          error_message: emailErrorMessage,
        },
        {
          onConflict: 'student_id,period_start,period_end',
        }
      );

    if (reportError) throw reportError;

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent
          ? 'Reporte generado y enviado por correo correctamente.'
          : recipientEmail
          ? 'Reporte generado, pero no se pudo enviar el correo.'
          : 'Reporte generado correctamente. El alumno no tiene correo registrado.',
        file_name: fileName,
        file_url: fileUrl,
        storage_path: storagePath,
        email_sent: emailSent,
        email_to: recipientEmail,
        email_error: emailErrorMessage,
        status,
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

    let message = 'Error generando reporte.';

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      const errorObject = error as {
        message?: string;
        error?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      message =
        errorObject.message ||
        errorObject.error ||
        errorObject.details ||
        errorObject.hint ||
        JSON.stringify(errorObject);
    }

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