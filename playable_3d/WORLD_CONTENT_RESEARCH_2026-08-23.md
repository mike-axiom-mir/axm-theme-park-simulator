# World Theme Park Content Research — 2026-08-23

## Purpose

This research pass looked at broad attraction, service, dining and retail patterns used by major theme parks and family parks, then translated those patterns into original AXM Theme Park content.

The goal is **not** to clone named commercial attractions, characters, trade dress or branded areas. The goal is to learn the reusable park-design vocabulary: what kinds of experiences make a park varied, readable, comfortable and fun across a full day.

## Sources sampled

Official/current park sources were preferred for categories and guest-service patterns:

- Efteling — whole-family attraction directory and current park pages:
  - https://www.efteling.com/en/park/whole-family
  - https://www.efteling.com/en/park
- Europa-Park — themed-area example combining interactive dark ride, monorail, food and public-space activity:
  - https://www.europapark.de/en/theme-park/attractions/themed-areas/luxembourg
- Tokyo Disney Resort — park-service directories covering convenience, accessibility/first aid, children/family, shopping and photo services:
  - https://www.tokyodisneyresort.jp/en/tdl/guide.html
  - https://www.tokyodisneyresort.jp/en/tds/guide
- LEGOLAND California — family attraction mix, themed lands, driving, interactive play, shopping/services and dining:
  - https://www.legoland.com/california/things-to-do/theme-park/
  - https://www.legoland.com/california/plan-your-visit/planning-tools/park-map/
- Universal Orlando / Hollywood — theme-park services, lockers, child/family facilities, first aid, dining, shopping and immersive attraction mix:
  - https://www.universalorlando.com/web/en/us/plan-your-visit/hours-information/theme-park-services
  - https://www.universalorlando.com/web/en/us/plan-your-visit/resort-maps
  - https://www.universalstudioshollywood.com/web/en/us/plan-your-visit/theme-park-vacation

## Reusable design findings

### 1. A real park is not a coaster list

Strong parks mix multiple tempos:

- high-energy thrill rides;
- classic rotating/flat rides;
- water rides;
- dark/indoor storytelling;
- interactive driving or game-like attractions;
- scenic transport and slow rides;
- observation experiences;
- free play/walkthrough spaces;
- shows and public-space entertainment.

The important game-design lesson is **choice of mood**, not maximum intensity.

### 2. Family parks make low-pressure experiences first-class

Boat rides, trains, monorails, carousels, driving attractions, play areas and gentle indoor rides create useful park time without every guest needing to queue for a headline thrill ride.

AXM translation: family content should still earn value through repeatability, atmosphere and park variety rather than being deliberately weak filler.

### 3. Water works at several intensity levels

The sampled parks use calm boat journeys, flume-like splash rides and rapids-style group rides as meaningfully different experiences.

AXM translation: Garden Drift, Timber Tumble and Rumble Rapids occupy different comfort/intensity/repeat niches rather than being reskins of one water ride.

### 4. Indoor attractions diversify weather and storytelling

Dark rides, 4D experiences and simulator/flying-theatre formats provide strong family/explorer value with very different spatial and sensory profiles from outdoor coasters.

AXM translation: Lantern Labyrinth, Cloud Cinema and Sky Sailor use the normal authoritative ride loop but receive distinct visual families and attraction profiles.

### 5. Practical services are part of the guest experience

Official park directories treat lockers, first aid, family-care facilities, information/lost-and-found, stroller rental, water refill, charging and quiet/sensory support as visible parts of a visit rather than invisible back-office functions.

AXM translation: these become buildable park facilities with readable models. Where the current visitor simulation already has a matching need (water/rest), they participate directly. Other support buildings remain honest passive facilities until a later visitor-use model is added.

### 6. Retail is place-making as well as commerce

Large parks use general souvenir stores, toys, apparel, photos, personalised goods and themed carts/stands as part of the street scene.

AXM translation: Memory Market, Toy Tinker, Park Threads, Snapshot Shop and Name-It Workshop are already buildable/animated retail identity pieces. They intentionally do not fake transactions before the guest model has a real shopping motive. Food retail that maps to the existing hunger loop is active immediately.

### 7. Food is stronger when it is legible and specific

Quick snacks, drinks, sweets, ice cream and compact carts create different visual rhythms and service patterns without needing restaurant-management complexity.

AXM translation: Sugar Cloud, Swirl Cart and Popcorn Planet are intentionally small, fast and readable. The existing Snack Rocket/Fizz Station remain the broader food/drink baseline.

## Content introduced from this pass

### Rides / attraction families

- Twirly Tea Garden — classic family cups
- Bumble Buggies — bumper-car arena
- Cloud Hop — gentle bounce tower
- Star Flyers — elevated swing chairs
- Sunbeam Lookout — observation tower
- Comet Drop — compact drop tower
- Timber Tumble — log-flume family splash
- Rumble Rapids — group rapids ride
- Lantern Labyrinth — indoor family dark ride
- Little Loop Railway — scenic park train
- Sky Ribbon — elevated scenic transport
- Garden Drift Boats — low-pressure scenic boat ride
- Cloud Cinema 4D — short indoor effects attraction
- Sky Sailor — flying-theatre/simulator style experience
- Tiny Town Drivers — self-directed driving attraction
- Acorn Adventure Play — free family play attraction
- Bubble Submarine — slow indoor exploration attraction

### Active service additions

- Free Refill Fountain — thirst service
- Quiet Cove — rest support
- Sugar Cloud — hunger service/store
- Swirl Cart — hunger service/store
- Popcorn Planet — hunger service/store

### Passive/future-ready support facilities

- Care Cabin — first aid
- Family Nest — family care
- Stash Station — lockers
- Hello Hub — information/lost-and-found
- Wagon Wheels — stroller/wagon rental
- Charge Grove — charging/rest corner

### Passive/future-ready retail

- Memory Market — souvenirs
- Toy Tinker — toys/plush
- Park Threads — apparel/weather gear
- Snapshot Shop — photo retail
- Name-It Workshop — personalised gifts

## Current truth boundary

This pack prioritises **content breadth with honest behavior**.

- Ride entries use the existing authoritative queue/economy/cycle/condition system.
- Refill/food/rest entries already map to existing visitor needs.
- Practical support and non-food retail are buildable, animated park content now, but do not pretend to have individual guest transactions before that behavior exists.
- No branded ride name, character, storyline or copyrighted park layout is imported.
- No full local test/build/WebGL pass is claimed from the GitHub-only steward seat.

The later local integration run should test the whole stack, adjust visual scale/performance, tune progression/economy, and decide whether a lightweight shopping/convenience motive should be added to visitors.
