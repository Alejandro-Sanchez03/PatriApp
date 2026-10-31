/* Configuración de la app.
 * Rellena estos dos datos con los de tu proyecto de Supabase:
 *   Supabase → tu proyecto → Project Settings → API (o «Connect»):
 *     - Project URL           → supabaseUrl
 *     - anon / public key     → supabaseAnonKey   (es pública: la protección la ponen las reglas de la base de datos)
 * Mientras estén vacíos, la app funciona sin cuenta, guardando solo en este dispositivo. */
window.PATRIMONIO_CONFIG = {
  supabaseUrl: 'https://zetgviysixxsieaelezq.supabase.co',
  supabaseAnonKey: 'sb_publishable_6QU8RYQtejSq0g-h6faFPg_PleTwKFZ',
  // Muestra «Crear una cuenta» en la pantalla de inicio. El registro de verdad se abre o cierra en
  // Supabase → Authentication → Sign In / Providers → «Allow new users to sign up».
  registroAbierto: true
};
