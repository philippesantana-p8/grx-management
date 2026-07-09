-- GRX Management — Aplicar OS fictícia SP → ES (colar no SQL Editor do Supabase)
-- Retorna: os_id, os_code, distance_km, agreed_amount

CREATE OR REPLACE FUNCTION public.seed_demo_freight_os(p_company_id UUID)
RETURNS TABLE (
    os_id UUID,
    os_code TEXT,
    distance_km NUMERIC,
    agreed_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vehicle RECORD;
    v_code TEXT;
    v_count INTEGER;
    v_distance NUMERIC := 867.42;
    v_antt NUMERIC := 5974.15;
    v_toll NUMERIC := 280.60;
    v_suggested NUMERIC := 6254.75;
    v_agreed NUMERIC := 6755.13;
    v_tolls JSONB := '[
        {"order":1,"name":"Imigrantes","city":"São Bernardo do Campo","state":"SP","amount":42.50},
        {"order":2,"name":"Praça de Registro","city":"Registro","state":"SP","amount":38.90},
        {"order":3,"name":"Praça de Caraguatatuba","city":"Caraguatatuba","state":"SP","amount":41.20},
        {"order":4,"name":"Praça de Rio Bonito","city":"Rio Bonito","state":"RJ","amount":36.80},
        {"order":5,"name":"Praça de Campos","city":"Campos dos Goytacazes","state":"RJ","amount":44.10},
        {"order":6,"name":"Praça de Linhares","city":"Linhares","state":"ES","amount":39.50},
        {"order":7,"name":"Praça de Serra","city":"Serra","state":"ES","amount":37.60}
    ]'::JSONB;
    v_antt_detail JSONB := '{
        "pisoMinimo": 5974.15,
        "parteDeslocamento": 5339.07,
        "parteCargaDescarga": 635.08,
        "tabela": "A",
        "eixosUtilizado": 5,
        "fonte": "Resolução ANTT 6.076/2026 (local)",
        "aviso": "OS fictícia para demonstração do PDF"
    }'::JSONB;
    v_inserted RECORD;
BEGIN
    SELECT id, plate, vehicle_category, axle_count, model, year
    INTO v_vehicle
    FROM public.vehicles
    WHERE company_id = p_company_id
      AND status = 'Ativo'
      AND deleted_at IS NULL
    ORDER BY
        CASE WHEN vehicle_category = 'Caminhao' THEN 0 ELSE 1 END,
        created_at ASC
    LIMIT 1;

    IF v_vehicle.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum veículo ativo encontrado. Cadastre um caminhão em Cadastros → Veículos.';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.service_orders
    WHERE company_id = p_company_id;

    v_code := 'OS' || LPAD((v_count + 1)::TEXT, 3, '0');

    INSERT INTO public.service_orders (
        company_id, code, service_type, service_date, status,
        vehicle_id, plate, brand, model, year, vehicle_type,
        client_name, phone, service_categories, service_name, service_amount,
        freight_origin_address, freight_destination_address, freight_distance_km,
        freight_toll_amount, freight_toll_count, freight_toll_detail,
        freight_antt_cargo_type, freight_antt_axles,
        freight_antt_composicao_veicular, freight_antt_alto_desempenho, freight_antt_retorno_vazio,
        freight_antt_minimum, freight_antt_detail,
        freight_suggested_total, freight_agreed_amount, freight_per_diem_charge_to, notes
    ) VALUES (
        p_company_id, v_code, 'Frete', CURRENT_DATE, 'Aberto',
        v_vehicle.id,
        UPPER(REPLACE(REPLACE(v_vehicle.plate, ' ', ''), '-', '')),
        NULL, v_vehicle.model, v_vehicle.year, v_vehicle.vehicle_category,
        'Distribuidora Atlântica Ltda (DEMO)', '(11) 98348-1803',
        ARRAY['Frete']::TEXT[], 'Frete', v_agreed,
        'São Paulo, SP', 'Vitória, ES', v_distance,
        v_toll, 7, v_tolls,
        5, COALESCE(v_vehicle.axle_count, 5),
        TRUE, FALSE, FALSE,
        v_antt, v_antt_detail,
        v_suggested, v_agreed, 'Cliente',
        'OS fictícia para demonstração do PDF — São Paulo (SP) → Vitória (ES).'
    )
    RETURNING id, code INTO v_inserted;

    os_id := v_inserted.id;
    os_code := v_inserted.code;
    distance_km := v_distance;
    agreed_amount := v_agreed;
    RETURN NEXT;
END;
$$;

-- Executa para a primeira empresa cadastrada
SELECT *
FROM public.seed_demo_freight_os(
    (SELECT company_id FROM public.company_members ORDER BY created_at ASC LIMIT 1)
);
