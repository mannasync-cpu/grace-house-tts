/**
 * Planning Center People API Service
 * Syncs contacts from Planning Center to Firestore.
 */

const PC_APP_ID = process.env.PLANNING_CENTER_APP_ID || '';
const PC_SECRET = process.env.PLANNING_CENTER_SECRET || '';
const PC_API = 'https://api.planningcenteronline.com/people/v2';

interface PlanningCenterPerson {
    id: string;
    name: string;
    email: string;
    phone: string | null;
}

/**
 * Fetch all people from Planning Center People API
 */
export async function fetchPlanningCenterPeople(): Promise<PlanningCenterPerson[]> {
    if (!PC_APP_ID || !PC_SECRET) {
        throw new Error('Planning Center credentials not configured');
    }

    const authHeader = 'Basic ' + Buffer.from(`${PC_APP_ID}:${PC_SECRET}`).toString('base64');
    const people: PlanningCenterPerson[] = [];
    let nextUrl: string | null = `${PC_API}/people?per_page=100&include=emails,phone_numbers`;

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: { Authorization: authHeader },
        });

        if (!response.ok) {
            throw new Error(`Planning Center API error: ${response.status}`);
        }

        const data = await response.json();
        const included = data.included || [];

        // Map included resources by type and ID
        const emailMap = new Map<string, string>();
        const phoneMap = new Map<string, string>();

        for (const inc of included) {
            if (inc.type === 'Email') {
                const personId = inc.relationships?.person?.data?.id;
                if (personId && inc.attributes?.address) {
                    emailMap.set(personId, inc.attributes.address);
                }
            }
            if (inc.type === 'PhoneNumber') {
                const personId = inc.relationships?.person?.data?.id;
                if (personId && inc.attributes?.number) {
                    phoneMap.set(personId, inc.attributes.number);
                }
            }
        }

        for (const person of data.data) {
            const attrs = person.attributes;
            people.push({
                id: person.id,
                name: `${attrs.first_name} ${attrs.last_name}`.trim(),
                email: emailMap.get(person.id) || '',
                phone: phoneMap.get(person.id) || null,
            });
        }

        // Pagination
        nextUrl = data.links?.next || null;
    }

    return people;
}

/**
 * Sync Planning Center people to Firestore contacts collection
 */
export async function syncPeopleToFirestore(
    db: FirebaseFirestore.Firestore,
): Promise<{ synced: number; created: number; updated: number }> {
    const people = await fetchPlanningCenterPeople();
    let created = 0;
    let updated = 0;

    const batch = db.batch();

    for (const person of people) {
        if (!person.email) continue; // Skip people without email

        // Check if contact already exists
        const existingSnap = await db.collection('contacts')
            .where('planningCenterId', '==', person.id)
            .limit(1)
            .get();

        if (existingSnap.empty) {
            // Create new contact
            const ref = db.collection('contacts').doc();
            batch.set(ref, {
                name: person.name,
                email: person.email,
                phone: person.phone,
                whatsappOptIn: false,
                emailOptIn: true,
                planningCenterId: person.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            created++;
        } else {
            // Update existing
            const ref = existingSnap.docs[0].ref;
            batch.update(ref, {
                name: person.name,
                email: person.email,
                phone: person.phone,
                updatedAt: new Date(),
            });
            updated++;
        }
    }

    await batch.commit();

    return { synced: people.length, created, updated };
}
