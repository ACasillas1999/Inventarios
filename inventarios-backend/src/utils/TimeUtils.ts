/**
 * Utilidades de tiempo para cálculos de KPIs considerando horas laborales
 */
export class TimeUtils {
    /**
     * Horas laborales configuradas
     * L-V: 09:00 - 19:00 (10 horas)
     * Sab: 09:00 - 14:00 (5 horas)
     */
    private static readonly WORK_START_HOUR = 9
    private static readonly WORK_END_WEEKDAY = 19
    private static readonly WORK_END_SATURDAY = 14

    /**
     * Calcula el tiempo neto laborado entre dos fechas en minutos
     */
    static getNetWorkingMinutes(start: Date, end: Date): number {
        if (end < start) return 0

        let totalMinutes = 0
        const cursor = new Date(start)

        while (cursor < end) {
            const day = cursor.getDay() // 0 = Dom, 1 = Lun, ..., 6 = Sab

            // Si es domingo, saltar al lunes a las 9am
            if (day === 0) {
                cursor.setDate(cursor.getDate() + 1)
                cursor.setHours(this.WORK_START_HOUR, 0, 0, 0)
                continue
            }

            const endOfWorkDay = new Date(cursor)
            endOfWorkDay.setHours(day === 6 ? this.WORK_END_SATURDAY : this.WORK_END_WEEKDAY, 0, 0, 0)

            const startOfWorkDay = new Date(cursor)
            startOfWorkDay.setHours(this.WORK_START_HOUR, 0, 0, 0)

            // Ajustar cursor si está antes de la hora de entrada
            if (cursor < startOfWorkDay) {
                cursor.setTime(startOfWorkDay.getTime())
            }

            // Si el cursor ya pasó la hora de salida de hoy, saltar al día siguiente a las 9am
            if (cursor >= endOfWorkDay) {
                cursor.setDate(cursor.getDate() + 1)
                cursor.setHours(this.WORK_START_HOUR, 0, 0, 0)
                continue
            }

            // Calcular hasta el fin de jornada o hasta la fecha 'end'
            const referenceEnd = end < endOfWorkDay ? end : endOfWorkDay
            const diffMs = referenceEnd.getTime() - cursor.getTime()
            totalMinutes += Math.floor(diffMs / 60000)

            // Mover cursor al final de lo procesado
            cursor.setTime(referenceEnd.getTime())

            // Si llegamos al fin de jornada, saltar al día siguiente
            if (cursor.getTime() === endOfWorkDay.getTime()) {
                cursor.setDate(cursor.getDate() + 1)
                cursor.setHours(this.WORK_START_HOUR, 0, 0, 0)
            }
        }

        return totalMinutes
    }

    /**
     * Formatea minutos a un string legible (Xh Ym)
     */
    static formatDuration(minutes: number): string {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        if (hours === 0) return `${mins}m`
        return `${hours}h ${mins}m`
    }
}
