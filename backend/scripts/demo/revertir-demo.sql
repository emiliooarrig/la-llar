-- Deshace exactamente lo que insertó demo-agosto-2026.sql.
-- No toca los datos de la semilla ni lo capturado durante la demo.

START TRANSACTION;

DELETE FROM asistencias WHERE sucursal_id = 1
  AND timestamp >= '2026-08-01 00:00:00' AND timestamp < '2026-09-01 00:00:00';

DELETE FROM justificaciones WHERE fecha LIKE '2026-08-%'
  AND empleado_id IN (1, 2, 9, 16);

DELETE FROM correcciones_asistencia WHERE fecha LIKE '2026-08-%'
  AND empleado_id IN (1, 2, 9, 16);

DELETE FROM documentos_proveedor WHERE ruta_archivo IN (
  '51a4fadf-4d41-a96b-090e-71e54c46e206.pdf',
  '014fc109-16c0-729c-92e0-fe0a7b757b9b.pdf',
  '07921447-e6ee-b824-2b8b-995047b526b2.pdf',
  '26e98159-5119-abd9-e6ca-45dfeff702ee.pdf',
  'ecbd7a25-c6b6-5830-f1e9-46ca11cb7369.pdf',
  '787f5e83-7417-0281-d05f-676399eee105.pdf',
  '69a7180d-d5c0-b7b4-680f-79449805f2c2.pdf',
  '1dfc10ba-331d-77ce-eb06-ff95c4b5247b.pdf',
  'e8ea9611-a316-8900-ac40-590bedfeef12.pdf',
  'c223abd2-a2be-8d0f-2ee0-cb970ddca53c.pdf'
);

DELETE FROM documentos_unidad WHERE ruta_archivo IN (
  '90c0524d-05a2-9625-a072-5b11a79a8c66.pdf',
  '7075b2e1-8956-dda8-ef57-f022c8087f8d.pdf',
  '59c2bb6b-09c0-70f7-d001-a54dcbb8ba96.pdf',
  'e52e019e-9444-6dcc-eaa5-19c3b4bf4e10.pdf',
  '8c425827-7bd8-ffca-b94d-94419f03ac72.pdf',
  '11aeca22-7050-7824-496f-bd31edb060af.pdf',
  '4d6363c6-0ea5-403a-d01a-e97f6109cc7f.pdf',
  '7467af21-96d8-b174-5df9-5ef4a4ab2887.pdf'
);

COMMIT;

-- Los PDFs quedan en backend/uploads/. Para borrarlos también:
--   cd backend/uploads && rm 51a4fadf* 014fc109* 07921447* 26e98159* ecbd7a25* 787f5e83* 69a7180d* 1dfc10ba* e8ea9611* c223abd2* 90c0524d* 7075b2e1* 59c2bb6b* e52e019e* 8c425827* 11aeca22* 4d6363c6* 7467af21*
