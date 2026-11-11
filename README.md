# Nuestras hijas

App web instalable en el móvil (PWA) para registrar y compartir en pareja el día a día de nuestras hijas:
tomas (pecho con cronómetro, biberón, sólidos), sueño, pañales, baños, temperatura, medicinas, salud
(síntomas, vacunas, citas), crecimiento (peso, altura, cabeza) y notas o hitos.

- **Hoy:** botones rápidos, cronómetros en marcha, "última toma/sueño/pañal" y la línea de tiempo del día.
- **Historial:** 7 días a 1 año, filtrable por tipo, con resumen diario.
- **Gráficas:** peso, altura, perímetro de cabeza y temperatura.
- **Ajustes:** hijas, código para invitar a la pareja, instrucciones de instalación.

Cada registro guarda quién lo hizo, y los cambios aparecen al momento en el móvil del otro.

## Probar en local

```bash
npm install
npm run dev
```

Sin configurar Supabase arranca en **modo demostración** (datos solo en ese navegador).

## Puesta en marcha

1. **Supabase (proyecto nuevo, separado de otros):** crea un proyecto, abre *SQL Editor* y ejecuta
   `supabase/schema.sql`. En *Authentication > URL Configuration* pon como *Site URL* la dirección
   donde se publique la app.
2. **Claves:** en *Project Settings > API* copia la *Project URL* y la clave *anon public*.
   - En local: copia `.env.example` a `.env.local` y rellénalo.
   - En GitHub: *Settings > Secrets and variables > Actions > Variables*, crea
     `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **Publicar:** en GitHub, *Settings > Pages > Source: GitHub Actions*. Cada push a `main` publica la app.
4. **Uso:** uno crea su cuenta y la familia; el otro crea su cuenta y elige *Tengo un código*
   (el código está en Ajustes).

La seguridad la pone la base de datos (Row Level Security): cada persona solo ve los datos de su familia.
La clave *anon* es pública por diseño; nunca uses la clave *service_role* en la app.
