# A&P Real Estate · CRM

CRM de gestión de pisos turísticos (Airbnb, Booking, reservas propias) y alquiler de habitaciones.
Next.js (React) + TypeScript + Tailwind + Lucide + Recharts, con Supabase como base de datos.

## Abrir sin instalar nada

Doble clic en **`Abrir CRM.bat`** (en la carpeta `CRM`). Abre la web ya generada (`web/out/index.html`)
en http://localhost:8765 usando solo PowerShell. Deja la ventana negra abierta mientras lo usas.

Para regenerar `out/` después de cambiar código: `npm run build`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin configurar nada, la app funciona en **modo local**: carga datos de ejemplo (Laxe, Cuéllar y Dénia,
con los totales reales de 2026) y guarda los cambios en el navegador.

## Supabase

El CRM está conectado al proyecto `aqmisgpaymhpjohvloro` (`.env.local`, que no se sube a git). Al tener
`.env.local`, la app pide iniciar sesión y guarda todo en Supabase. Como las variables se incrustan al compilar,
tras cambiarlas hay que volver a ejecutar `npm run build`.

**Acceso.** No basta con tener usuario: solo ven y editan datos los usuarios que están en la tabla `team_members`
(la clave de la app es pública y el registro de Supabase puede estar abierto). Para dar de alta a alguien:

1. *Authentication → Users → Add user*, con email y contraseña (marca «Auto confirm user»).
2. En *SQL Editor*:
   ```sql
   insert into team_members (user_id, email)
   select id, email from auth.users where email = 'persona@ejemplo.com';
   ```

Un usuario que no esté en `team_members` puede entrar, pero ve el CRM vacío y un aviso.

**Datos.** Con la base de datos vacía, **Ajustes** ofrece «Cargar datos de ejemplo en Supabase» y, si el
navegador conserva datos del modo local, «Subir a Supabase».

**Proyecto nuevo desde cero:** ejecuta `supabase/migrations/0001_schema.sql` en *SQL Editor*, crea los usuarios
como arriba y copia `.env.local.example` a `.env.local` con la URL y la clave publicable.

## Cómo está organizado

Cada propiedad pertenece a una de tres categorías, y el **Panel** (portada) las muestra en tres secciones:

- **Alquiler turístico**: Booking, Airbnb y reservas propias.
- **Alquiler por habitaciones**: cada piso tiene sus habitaciones (alquilada, reservada o libre) con renta, inquilino y fin de contrato. La ficha avisa de los contratos que vencen en 45 días.
- **Contratos**: uno por cada habitación alquilada o reservada (hecho o pendiente, renta, inicio y fin). Se ven en el Panel, tras las habitaciones, y en la página «Contratos» con filtros.
- **Venta**: sin reservas; estados disponible, reservada, en arras y vendida.

Las reservas y los gastos fijos se gestionan dentro de la ficha de cada propiedad. Desde «Acciones rápidas»
se puede crear una reserva, agregar una propiedad e importar desde CSV propiedades, habitaciones (con sus contratos)
y reservas, en ese orden: las habitaciones y las reservas buscan su piso por nombre o código. Cada importador tiene
su plantilla, enseña una vista previa con los errores por fila y acepta los CSV de Excel en español (`;` y acentos).

## Estructura

| Ruta | Contenido |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tablas, relaciones, vista `v_resumen_mensual` con las fórmulas, RLS por `team_members` |
| `src/lib/types.ts` | Tipos 1:1 con las tablas |
| `src/lib/calc.ts` | Fórmulas de negocio (gestión con reparto / subarriendo), ocupación, libro P&L |
| `src/lib/store.tsx` | Carga y CRUD: Supabase o navegador |
| `src/lib/seed.ts` | Datos de ejemplo |
| `src/components/domain.tsx` | Categorías, estados, canales y modelos de negocio |
| `src/components/shell/` | Inicio de sesión, barra lateral, barra superior, buscador |
| `src/app/page.tsx` | Panel: propiedades por categoría con sus cifras |
| `src/app/propiedades/ficha` | Ficha (`/propiedades/ficha?id=…`): Resumen anual, Reservas, Gastos fijos y Datos; en venta, solo Datos |
| `src/components/rooms` | Habitaciones (barra de ocupación, tarjetas, formulario) y tabla de contratos |
| `src/app/contratos` | Contratos de todas las habitaciones, con filtros y exportación |
| `src/app/ajustes` | Origen de los datos y datos de ejemplo |
