/**
 * Utilidades de tiempo para cálculos de KPIs considerando horas laborales
 */
export declare class TimeUtils {
    /**
     * Horas laborales configuradas
     * L-V: 09:00 - 19:00 (10 horas)
     * Sab: 09:00 - 14:00 (5 horas)
     */
    private static readonly WORK_START_HOUR;
    private static readonly WORK_END_WEEKDAY;
    private static readonly WORK_END_SATURDAY;
    /**
     * Calcula el tiempo neto laborado entre dos fechas en minutos
     */
    static getNetWorkingMinutes(start: Date, end: Date): number;
    /**
     * Formatea minutos a un string legible (Xh Ym)
     */
    static formatDuration(minutes: number): string;
}
//# sourceMappingURL=TimeUtils.d.ts.map