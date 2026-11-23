import type { HotelRule, SampleQuestion } from '../types.js';

const NOW = new Date().toISOString();

export const HOTEL_NAME = 'Grand Aurora Hotel';

export const DEFAULT_RULES: HotelRule[] = [
  {
    id: 'rule-breakfast-hours',
    title: 'Breakfast Hours & Location',
    category: 'Dining',
    content:
      'Breakfast is served daily between 6:30 AM and 10:30 AM in the Wintergarden Lounge on the 2nd floor. Continental and hot buffet options are included for all registered guests.',
    updatedAt: NOW,
  },
  {
    id: 'rule-room-service',
    title: 'Room Service Schedule & Fee',
    category: 'Dining',
    content:
      'In-room dining operates daily from 7:00 AM to 11:00 PM with a flat $6 tray delivery fee. Between 11:00 PM and 7:00 AM, grab-and-go snacks and hot drinks are available 24/7 at the Lobby Pantry.',
    updatedAt: NOW,
  },
  {
    id: 'rule-rooftop-bar',
    title: 'Aurora Rooftop Bar',
    category: 'Dining',
    content:
      'The Aurora Rooftop Bar on the 12th floor is open daily from 4:00 PM to 12:30 AM. Smart-casual attire is requested after 8:00 PM, and reservations are recommended on Fridays and Saturdays.',
    updatedAt: NOW,
  },
  {
    id: 'rule-checkin-checkout',
    title: 'Standard Check-in & Check-out Times',
    category: 'Check-in & Check-out',
    content:
      'Standard check-in begins at 3:00 PM and check-out is by 11:00 AM. Express check-out is available by dropping your keycard in the brass box beside the front desk.',
    updatedAt: NOW,
  },
  {
    id: 'rule-late-checkout',
    title: 'Late Check-out Policy',
    category: 'Check-in & Check-out',
    content:
      'Late check-out until 2:00 PM may be requested at reception for a $35 fee, subject to room availability. Aurora Loyalty Gold members receive complimentary late check-out until 2:00 PM.',
    updatedAt: NOW,
  },
  {
    id: 'rule-luggage-storage',
    title: 'Complimentary Luggage Storage',
    category: 'Check-in & Check-out',
    content:
      'Guests may store luggage free of charge at the bell desk starting at 7:00 AM on the day of arrival and until 8:00 PM on the day of departure.',
    updatedAt: NOW,
  },
  {
    id: 'rule-pool-sauna',
    title: 'Infinity Pool & Finnish Sauna',
    category: 'Wellness & Spa',
    content:
      'The heated indoor infinity pool and Finnish sauna on the 5th floor are open daily from 6:00 AM to 10:00 PM. Children under 14 must be accompanied by an adult, and swimwear is required in the pool.',
    updatedAt: NOW,
  },
  {
    id: 'rule-fitness-center',
    title: '24-Hour Fitness Center',
    category: 'Wellness & Spa',
    content:
      'The fitness center on the 4th floor is open 24 hours a day using your guestroom keycard. Complimentary chilled towels, yoga mats, and infused water are provided.',
    updatedAt: NOW,
  },
  {
    id: 'rule-spa-bookings',
    title: 'Spa Appointments & Cancellation',
    category: 'Wellness & Spa',
    content:
      'Massage and facial treatments at the Aurora Spa must be booked at least 4 hours in advance by dialing extension 5500. Appointments can be rescheduled or cancelled free of charge up to 2 hours beforehand.',
    updatedAt: NOW,
  },
  {
    id: 'rule-pet-policy',
    title: 'Pet Policy & Cleaning Fee',
    category: 'Pets & Accessibility',
    content:
      'Dogs and cats up to 25 lbs (11 kg) are welcome in designated pet-friendly rooms for a flat $45 cleaning fee per stay, with a maximum of two pets per room. Certified service animals stay free of charge.',
    updatedAt: NOW,
  },
  {
    id: 'rule-pet-areas',
    title: 'Pet Etiquette in Public Areas',
    category: 'Pets & Accessibility',
    content:
      'Pets must be kept on a leash in all hallways and lobby areas and may not be left unattended in guestrooms during housekeeping. Pets are not permitted inside the Wintergarden Lounge or the 5th-floor pool area.',
    updatedAt: NOW,
  },
  {
    id: 'rule-accessibility',
    title: 'Accessible Rooms & Equipment',
    category: 'Pets & Accessibility',
    content:
      'Step-free accessible rooms with roll-in showers, visual fire alarms, and shower chairs are available on floors 2 through 6. Hearing-aid induction loops are installed at reception and in all meeting rooms.',
    updatedAt: NOW,
  },
  {
    id: 'rule-parking',
    title: 'Underground & Valet Parking',
    category: 'Parking & Transport',
    content:
      'Underground self-parking costs $22 per night with unlimited in-and-out access using your room keycard. Valet parking is available at the main portico for $34 per night.',
    updatedAt: NOW,
  },
  {
    id: 'rule-ev-charging',
    title: 'EV Charging Stations',
    category: 'Parking & Transport',
    content:
      'Four Level-2 electric vehicle charging stalls are located on Parking Level B1 near the elevators. Charging is complimentary for registered guests with a 4-hour maximum per session.',
    updatedAt: NOW,
  },
  {
    id: 'rule-airport-shuttle',
    title: 'Airport Electric Shuttle',
    category: 'Parking & Transport',
    content:
      'A complimentary electric shuttle to Central Airport departs from the main entrance every 30 minutes on the hour and half-hour between 5:00 AM and 11:30 PM. No reservation is required for parties under 6.',
    updatedAt: NOW,
  },
  {
    id: 'rule-wifi',
    title: 'Guest Wi-Fi Network & Password',
    category: 'Wi-Fi & Workspace',
    content:
      'Complimentary gigabit fiber Wi-Fi is available throughout the property. Connect to the network "GrandAurora-Guest" using the seasonal password "NorthernLights26".',
    updatedAt: NOW,
  },
  {
    id: 'rule-quiet-hours',
    title: 'Quiet Hours & Mezzanine Co-working',
    category: 'Wi-Fi & Workspace',
    content:
      'Quiet hours are observed on all guestroom floors from 10:30 PM to 7:00 AM. Guests needing to take late calls may use the soundproof co-working booths on the mezzanine level, which stay open 24 hours.',
    updatedAt: NOW,
  },
  {
    id: 'rule-cancellation-deposit',
    title: 'Cancellation Policy & Security Deposit',
    category: 'Cancellation & Billing',
    content:
      'Standard reservations may be cancelled free of charge up to 48 hours before 3:00 PM on the check-in date; later cancellations incur a one-night room charge. A refundable $100 security deposit hold is authorized at check-in and released within 3 business days after departure.',
    updatedAt: NOW,
  },
];

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    label: 'Breakfast hours',
    question: 'What time is breakfast served, and which floor is it on?',
  },
  {
    label: 'Bringing a dog',
    question: 'Can I bring my 20 lb dog, how much is the fee, and can he join me at breakfast?',
  },
  {
    label: 'Wi-Fi details',
    question: 'What is the Wi-Fi network name and password at the Grand Aurora Hotel?',
  },
  {
    label: 'Late check-out',
    question: 'What is the normal check-out time, and how much does late check-out cost?',
  },
  {
    label: 'Airport & EV parking',
    question: 'How often does the airport shuttle run, and do you have EV chargers?',
  },
  {
    label: 'Cancellation & deposit',
    question: 'How far in advance can I cancel for free, and what is the security deposit hold?',
  },
];
