const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const additionalSymptoms = {
  electronics: [
    { slug: 'not_powering_on', name: 'Not Powering On' },
    { slug: 'screen_flickering', name: 'Screen Flickering/Blank' },
    { slug: 'overheating', name: 'Overheating' },
    { slug: 'battery_draining', name: 'Battery Draining Quickly' },
    { slug: 'water_damage', name: 'Water Damage' },
  ],
  appliances: [
    { slug: 'not_cooling', name: 'Not Cooling/Heating' },
    { slug: 'making_loud_noises', name: 'Making Loud Noises' },
    { slug: 'leaking_water', name: 'Leaking Water' },
    { slug: 'door_not_closing', name: 'Door Not Closing Properly' },
    { slug: 'error_code_displayed', name: 'Error Code Displayed' },
  ],
  plumbing: [
    { slug: 'clogged_drain', name: 'Clogged Drain' },
    { slug: 'leaky_faucet', name: 'Leaky Faucet/Pipe' },
    { slug: 'no_hot_water', name: 'No Hot Water' },
    { slug: 'low_water_pressure', name: 'Low Water Pressure' },
    { slug: 'running_toilet', name: 'Running Toilet' },
  ],
  hvac: [
    { slug: 'not_blowing_cold_air', name: 'Not Blowing Cold Air' },
    { slug: 'weird_smell', name: 'Weird Smell' },
    { slug: 'thermostat_not_working', name: 'Thermostat Not Working' },
    { slug: 'system_wont_turn_on', name: 'System Won\'t Turn On' },
    { slug: 'frequent_cycling', name: 'Frequent Cycling' },
  ],
  tools: [
    { slug: 'motor_burning_smell', name: 'Motor Burning Smell' },
    { slug: 'no_power', name: 'No Power/Dead Battery' },
    { slug: 'unusual_vibration', name: 'Unusual Vibration' },
    { slug: 'stuck_bit_blade', name: 'Stuck Bit/Blade' },
  ]
};

async function main() {
  const categories = await prisma.equipmentCategory.findMany();
  
  let added = 0;
  for (const cat of categories) {
    const symptoms = additionalSymptoms[cat.slug] || [
      { slug: 'general_failure', name: 'General Failure' },
      { slug: 'physical_damage', name: 'Physical Damage' },
      { slug: 'strange_noise', name: 'Strange Noise' },
    ];
    
    for (const symp of symptoms) {
      await prisma.symptom.upsert({
        where: {
          categoryId_slug: {
            categoryId: cat.id,
            slug: symp.slug
          }
        },
        update: {},
        create: {
          categoryId: cat.id,
          slug: symp.slug,
          name: symp.name,
        }
      });
      added++;
    }
  }
  console.log(`Successfully added/verified ${added} symptoms across ${categories.length} categories.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
