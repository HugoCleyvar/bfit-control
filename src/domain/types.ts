export type UUID = string;

export type UserRole = 'admin' | 'colaborador';
export type UserStatus = 'activo' | 'inactivo';
export type SubscriptionStatus = 'activa' | 'vencida' | 'cancelada';

// Profile (auth)
export interface Profile {
    id: UUID;
    nombre: string;
    rol: UserRole;
    turno_asignado?: string | null;
    activo: boolean;
}

// Usuarios (Miembros)
export interface Member {
    id: UUID;
    foto_url?: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    fecha_nacimiento?: string; // ISO Date
    estatus: UserStatus;
    fecha_registro: string; // ISO Date
    colaborador_id?: UUID; // Who registered
    visitas_disponibles?: number;
    ultima_visita?: string; // ISO Date
}

// Planes
export interface Plan {
    id: UUID;
    nombre: string;
    precio: number;
    duracion_dias: number;
    activo: boolean;
}

// Suscripciones
export interface Subscription {
    id: UUID;
    usuario_id: UUID;
    plan_id: UUID;
    fecha_inicio: string; // ISO Date
    fecha_vencimiento: string; // ISO Date
    estatus: SubscriptionStatus;

    // Joins opcionales
    plan?: Plan;
    usuario?: Member;
}

// Asistencias
export interface Attendance {
    id: UUID;
    usuario_id: UUID;
    fecha_hora: string; // ISO Date
    turno_id?: UUID;
    colaborador_id?: UUID;
    permitido: boolean;

    usuario?: Member;
}

// Pagos
export interface Payment {
    id: UUID;
    usuario_id?: UUID;
    plan_id?: UUID;
    total: number;
    metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia';
    fecha_pago: string; // ISO Date
    colaborador_id: UUID;
    turno_id?: UUID;
    concepto?: string;
}

export interface CashCount {
    [denomination: number]: number;
}

export interface Expense {
    id: UUID;
    turno_id: UUID;
    monto: number;
    concepto: string;
    fecha_hora: string;
    usuario_id?: UUID;
}

export interface Shift {
    id: UUID;
    colaborador_id: UUID;
    colaborador_nombre?: string;
    horario: 'matutino' | 'vespertino';
    hora_inicio: string;
    hora_cierre?: string;
    total_efectivo: number;
    monto_inicial: number;
    retiros: number;
    desglose_cierre?: CashCount;
    estatus: 'abierto' | 'cerrado';
    validado_admin?: boolean;
}
