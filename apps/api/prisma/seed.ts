import { PrismaClient, ServiceType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../src/lib/config';

const db = new PrismaClient();

async function main() {
  // Usuario admin
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await db.adminUser.upsert({
    where: { email: config.adminEmail },
    update: {},
    create: { email: config.adminEmail, password_hash: passwordHash },
  });
  console.log(`Admin: ${config.adminEmail} / ${config.adminPassword}`);

  // Restaurante demo
  const existing = await db.restaurant.findFirst({ where: { name: 'La Brasa (demo)' } });
  if (existing) {
    console.log('El restaurante demo ya existe, no se vuelve a crear.');
    return;
  }

  const restaurant = await db.restaurant.create({
    data: {
      name: 'La Brasa (demo)',
      phone: '+34900000000',
      timezone: 'Europe/Madrid',
      default_language: 'es',
      is_ai_enabled: true,
      max_party_size_global: 12,
    },
  });

  // Horarios: comida mar-dom 13:00-16:00, cena mar-sab 20:00-23:30. Lunes cerrado.
  const opening: { day_of_week: number; open_time: string; close_time: string; service_type: ServiceType }[] = [];
  for (const day of [2, 3, 4, 5, 6, 0]) {
    opening.push({ day_of_week: day, open_time: '13:00', close_time: '16:00', service_type: 'lunch' });
  }
  for (const day of [2, 3, 4, 5, 6]) {
    opening.push({ day_of_week: day, open_time: '20:00', close_time: '23:30', service_type: 'dinner' });
  }
  await db.openingHours.createMany({
    data: opening.map((o) => ({ ...o, restaurant_id: restaurant.id })),
  });

  // Franjas: capacidades del ejemplo del diseño (más altas en la franja central)
  const lunchSlots: [string, number][] = [
    ['13:00', 16],
    ['13:30', 16],
    ['14:00', 24],
    ['14:30', 24],
    ['15:00', 16],
  ];
  const dinnerSlots: [string, number][] = [
    ['20:00', 20],
    ['20:30', 20],
    ['21:00', 30],
    ['21:30', 30],
    ['22:00', 20],
  ];

  const rules: {
    day_of_week: number;
    service_type: ServiceType;
    slot_time: string;
    max_covers: number;
  }[] = [];
  for (const day of [2, 3, 4, 5, 6, 0]) {
    for (const [slot, covers] of lunchSlots) {
      rules.push({ day_of_week: day, service_type: 'lunch', slot_time: slot, max_covers: covers });
    }
  }
  for (const day of [2, 3, 4, 5, 6]) {
    for (const [slot, covers] of dinnerSlots) {
      rules.push({ day_of_week: day, service_type: 'dinner', slot_time: slot, max_covers: covers });
    }
  }
  await db.availabilityRule.createMany({
    data: rules.map((r) => ({
      ...r,
      restaurant_id: restaurant.id,
      max_party_size_auto_confirm: 8,
      reservation_duration_minutes: 90,
    })),
  });

  console.log(`Restaurante demo creado: ${restaurant.id} (${restaurant.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
