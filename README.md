# Ñam Ñam

Aplicación web/PWA mobile-first para reemplazar el seguimiento nutricional en Google Sheets.

## Incluido

- Pantalla **Hoy** con objetivo de kcal y macros, colores por cercanía al objetivo y aviso al alcanzar proteína.
- Registro por Desayuno, Colación 1, Almuerzo, Colación 2, Merienda y Cena.
- Buscador único de alimentos y recetas.
- Historial diario con calendario.
- Evolución de 7, 30 y 90 días.
- CRUD de alimentos con valores cada 100 g / 100 ml.
- CRUD de recetas con ingredientes en gramos, peso crudo y peso final cocinado.
- Cálculo nutricional por 100 g final de cada receta.
- Módulo **Súper** independiente.
- Objetivos diarios editables.
- Persistencia local inmediata y sincronización opcional con Supabase mediante magic-link por email.
- Estructura SQL reservada para entrenamientos futuros.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Sin configurar Supabase, la app funciona en modo local y guarda los datos en `localStorage` del navegador.

## Activar sincronización entre PC y celular

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en **SQL Editor**.
3. En Authentication, habilitar el proveedor Email / Magic Link.
4. Copiar `.env.example` a `.env.local`.
5. Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

6. Reiniciar `npm run dev`.
7. Ir a **Ajustes > Sincronización** e ingresar el email.

Cuando hay sesión de Supabase, el estado completo se guarda en una fila JSONB privada por usuario con RLS. Esto conserva alimentos, recetas, pesos de cocción, objetivos, historial y lista de supermercado.

## Datos iniciales

Se incluyen alimentos y recetas de ejemplo basados en la estructura actual del usuario. Se pueden editar, desactivar o ampliar desde la propia interfaz.

## Notas de arquitectura

- Next.js + React + TypeScript.
- Supabase Auth + Postgres para sincronización.
- La app guarda snapshots de macros en cada consumo, por lo que editar un alimento o receta no reescribe retroactivamente el historial.
- Todas las recetas trabajan en gramos/ml; no hay conversiones por lata, pote o unidad.
- El peso final cocinado determina los macros por 100 g de recetas horneadas/cocinadas.
