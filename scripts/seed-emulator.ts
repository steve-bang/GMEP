/* Seeds fake demo data into the Firebase Emulator Suite. Emulator only. */
import { loadEnv } from '@/platform/config/env';
import { seedFirestoreEmulator } from '@/infrastructure/seed/seed';

seedFirestoreEmulator(loadEnv())
  .then(() => console.log('Seeded demo data into the emulator.'))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
