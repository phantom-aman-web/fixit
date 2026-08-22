import { db } from "./src/lib/db";

async function seedGenericCategories() {
  const categories = [
    { slug: "tv", name: "Television", description: "Smart TVs, LEDs, OLEDs, and plasma screens." },
    { slug: "laptop", name: "Laptop Computer", description: "MacBooks, Windows laptops, and Chromebooks." },
    { slug: "smartphone", name: "Smartphone", description: "iPhones, Android phones, and tablets." },
    { slug: "hvac", name: "HVAC & AC", description: "Air conditioners, heaters, and thermostats." },
    { slug: "power_tools", name: "Power Tools", description: "Drills, saws, chainsaws, and workshop equipment." },
    { slug: "lawn_garden", name: "Lawn & Garden", description: "Lawn mowers, trimmers, and outdoor equipment." },
    { slug: "microwave", name: "Microwave Oven", description: "Countertop and built-in microwaves." },
    { slug: "coffee_maker", name: "Coffee Maker", description: "Espresso machines, drip coffee, and pod brewers." },
    { slug: "plumbing", name: "Plumbing Fixtures", description: "Toilets, sinks, faucets, and showers." },
    { slug: "smart_home", name: "Smart Home", description: "Security cameras, smart locks, and hubs." }
  ];

  console.log("Seeding universal categories...");
  for (const cat of categories) {
    const existing = await db.equipmentCategory.findUnique({ where: { slug: cat.slug } });
    if (!existing) {
      await db.equipmentCategory.create({
        data: {
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          symptoms: {
            create: {
              slug: 'general_issue',
              name: 'General Issue',
            }
          }
        }
      });
      console.log(`Created category: ${cat.name}`);
    }
  }
  console.log("Done.");
}

seedGenericCategories()
  .catch(console.error)
  .finally(() => db.$disconnect());
