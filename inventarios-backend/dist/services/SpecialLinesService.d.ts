export interface SpecialLine {
    id: number;
    line_code: string;
    line_name: string | null;
    tolerance_percentage: number;
    whatsapp_numbers: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSpecialLineData {
    line_code: string;
    line_name?: string;
    tolerance_percentage?: number;
    whatsapp_numbers?: string[];
    is_active?: boolean;
}
export interface UpdateSpecialLineData {
    line_name?: string;
    tolerance_percentage?: number;
    whatsapp_numbers?: string[];
    is_active?: boolean;
}
/**
 * SpecialLinesService - Servicio para gestionar líneas especiales
 * que requieren monitoreo especial en conteos de inventario
 */
export declare class SpecialLinesService {
    private pool;
    /**
     * Obtiene todas las líneas especiales
     */
    getAll(): Promise<SpecialLine[]>;
    /**
     * Obtiene solo las líneas activas
     */
    getActive(): Promise<SpecialLine[]>;
    /**
     * Obtiene una línea por ID
     */
    getById(id: number): Promise<SpecialLine | null>;
    /**
     * Obtiene una línea por código
     */
    getByLineCode(lineCode: string): Promise<SpecialLine | null>;
    /**
     * Verifica si un artículo pertenece a una línea especial activa
     * @param itemCode Código del artículo
     * @returns Línea especial si pertenece, null si no
     */
    checkItemBelongsToSpecialLine(itemCode: string): Promise<SpecialLine | null>;
    /**
     * Crea una nueva línea especial
     */
    create(data: CreateSpecialLineData, userId: number): Promise<SpecialLine>;
    /**
     * Actualiza una línea especial
     */
    update(id: number, data: UpdateSpecialLineData, userId: number): Promise<SpecialLine>;
    /**
     * Elimina una línea especial
     */
    delete(id: number, userId: number): Promise<void>;
    /**
     * Activa o desactiva una línea especial
     */
    toggleActive(id: number, isActive: boolean, userId: number): Promise<SpecialLine>;
    /**
     * Parsea una fila de la base de datos a SpecialLine
     */
    private parseSpecialLine;
    /**
     * Obtiene los números de WhatsApp parseados como array
     */
    getWhatsAppNumbers(specialLine: SpecialLine): string[];
}
export declare const specialLinesService: SpecialLinesService;
export default SpecialLinesService;
//# sourceMappingURL=SpecialLinesService.d.ts.map