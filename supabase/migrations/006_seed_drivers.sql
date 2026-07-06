-- GRX Management — Seed motoristas da planilha GRX V3
-- Migration: 006_seed_drivers.sql
-- Origem: aba Cadastro_Motoristas (todos os códigos únicos, upsert por company_id+code)

CREATE OR REPLACE FUNCTION public.seed_drivers(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO public.drivers (
        company_id, code, name, name_normalized, driver_type, status,
        phone, document, cnh_number, cnh_expiry_date, active_for_operations, notes
    )
    SELECT
        p_company_id,
        v.code, v.name, v.name_normalized, v.driver_type, v.status,
        v.phone, v.document, NULL, NULL, v.active_for_operations, v.notes
    FROM (VALUES
        ('MOT001', 'Agregado', 'agregado', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT002', 'Allan', 'allan', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT003', 'Anderson', 'anderson', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT004', 'Aparecido', 'aparecido', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT005', 'Aparecido Júnior', 'aparecido junior', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT006', 'Barbosa', 'barbosa', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT007', 'Caio', 'caio', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT008', 'Carlos Leal', 'carlos leal', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT009', 'Cassiano', 'cassiano', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT010', 'Celso', 'celso', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT011', 'Christian', 'christian', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT012', 'Clayton', 'clayton', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT013', 'Cristovão', 'cristovao', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT014', 'Cristóvão', 'cristovao', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT015', 'Daniel', 'daniel', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT016', 'Diego', 'diego', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT017', 'Diego Jeronimo', 'diego jeronimo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT018', 'Dilso', 'dilso', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT019', 'Dilson', 'dilson', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT020', 'Elton', 'elton', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT021', 'Fernando', 'fernando', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT022', 'Gladson', 'gladson', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT023', 'Igor', 'igor', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT024', 'Izael', 'izael', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT025', 'John', 'john', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT026', 'Jonathan', 'jonathan', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT027', 'José Carlos', 'jose carlos', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT028', 'José Cristovão', 'jose cristovao', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT029', 'Junior', 'junior', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT030', 'Júnior', 'junior', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT031', 'Leandro', 'leandro', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT032', 'Lucas', 'lucas', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT033', 'Lucas de Castro', 'lucas de castro', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT034', 'Luciane', 'luciane', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT035', 'Luiz da Silva', 'luiz da silva', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT036', 'Magno', 'magno', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT037', 'Marcelo', 'marcelo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT038', 'Marcelo Donizete', 'marcelo donizete', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT039', 'Mikio', 'mikio', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT040', 'Milton', 'milton', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT041', 'Neto', 'neto', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT042', 'Osvaldo', 'osvaldo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT043', 'Otacilio', 'otacilio', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT044', 'Paulino', 'paulino', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT045', 'Paulo', 'paulo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT046', 'Rafa', 'rafa', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT047', 'Rafael', 'rafael', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT048', 'Ricardo', 'ricardo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT049', 'Roberto', 'roberto', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT050', 'Rodrigo', 'rodrigo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT051', 'Rozinaldo', 'rozinaldo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT052', 'Salários', 'salarios', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT053', 'Saulo', 'saulo', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT054', 'Silas', 'silas', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT055', 'Talles ramos', 'talles ramos', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT056', 'Tiago', 'tiago', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT057', 'Tiago Santos', 'tiago santos', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT058', 'Tiago Silva', 'tiago silva', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT059', 'Tyago', 'tyago', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT060', 'Van Agregada', 'van agregada', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT061', 'Vando', 'vando', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes'),
        ('MOT062', 'Wesley', 'wesley', 'Motorista', 'Ativo', NULL, NULL, TRUE, 'Importado dos lançamentos existentes')
    ) AS v(code, name, name_normalized, driver_type, status, phone, document, active_for_operations, notes)
    ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        name_normalized = EXCLUDED.name_normalized,
        driver_type = EXCLUDED.driver_type,
        status = EXCLUDED.status,
        phone = EXCLUDED.phone,
        document = EXCLUDED.document,
        active_for_operations = EXCLUDED.active_for_operations,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.seed_drivers(UUID) IS
    'Importa motoristas da planilha Cadastro_Motoristas para a empresa informada.';

GRANT EXECUTE ON FUNCTION public.seed_drivers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_drivers(UUID) TO service_role;
