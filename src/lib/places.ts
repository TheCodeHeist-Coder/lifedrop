export type Place = { name: string; lat: number; lng: number; aliases?: string[] };

export const DELHI_NCR_PLACES: Place[] = [
  { name: "Connaught Place", lat: 28.6315, lng: 77.2167, aliases: ["CP"] },
  { name: "AIIMS Delhi", lat: 28.5672, lng: 77.21, aliases: ["AIIMS", "Ansari Nagar"] },
  { name: "Safdarjung Hospital", lat: 28.5686, lng: 77.2066, aliases: ["Safdarjung"] },
  { name: "Karol Bagh", lat: 28.6519, lng: 77.1909 },
  { name: "Rohini", lat: 28.7495, lng: 77.0565 },
  { name: "SSCBS Rohini", lat: 28.7296, lng: 77.112, aliases: ["SSCBS"] },
  { name: "Pitampura", lat: 28.7033, lng: 77.132 },
  { name: "Dwarka", lat: 28.5921, lng: 77.046 },
  { name: "Janakpuri", lat: 28.6219, lng: 77.0878 },
  { name: "Saket", lat: 28.5245, lng: 77.2066 },
  { name: "Lajpat Nagar", lat: 28.5677, lng: 77.2433 },
  { name: "Vasant Kunj", lat: 28.52, lng: 77.159 },
  { name: "Shahdara", lat: 28.6735, lng: 77.289 },
  { name: "Mayur Vihar", lat: 28.6096, lng: 77.2958 },
  { name: "Okhla", lat: 28.5355, lng: 77.264 },
  { name: "Noida", lat: 28.5355, lng: 77.391 },
  { name: "Greater Noida", lat: 28.4744, lng: 77.504 },
  { name: "Ghaziabad", lat: 28.6692, lng: 77.4538 },
  { name: "Gurugram", lat: 28.4595, lng: 77.0266, aliases: ["Gurgaon"] },
  { name: "Faridabad", lat: 28.4089, lng: 77.3178 },
  { name: "Sonipat", lat: 28.9931, lng: 77.0151 },
  { name: "Meerut", lat: 28.9845, lng: 77.7064 },
  { name: "Panipat", lat: 29.3909, lng: 76.9635 },
  { name: "Rewari", lat: 28.199, lng: 76.619 },
  { name: "Mathura", lat: 27.4924, lng: 77.6737 },
];

export const CITY_PLACES: Place[] = [
  { name: "Delhi", lat: 28.6139, lng: 77.209, aliases: ["New Delhi"] },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, aliases: ["Bombay"] },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, aliases: ["Bangalore"] },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, aliases: ["Madras"] },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, aliases: ["Calcutta"] },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Patna", lat: 25.5941, lng: 85.1376 },
  { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { name: "Indore", lat: 22.7196, lng: 75.8577 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
  { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { name: "Raipur", lat: 21.2514, lng: 81.6296 },
  { name: "Srinagar", lat: 34.0837, lng: 74.7973 },
  { name: "Shimla", lat: 31.1048, lng: 77.1734 },
  { name: "Dehradun", lat: 30.3165, lng: 78.0322 },
  { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366, aliases: ["Trivandrum"] },
  { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
];

// Far from the seeded donors, so the demo can show what happens when nobody is in
// reach, which is the geographic gap in the problem statement.
export const REMOTE_PLACES: Place[] = [
  { name: "Gadchiroli", lat: 20.1809, lng: 80.0 },
  { name: "Tawang", lat: 27.5861, lng: 91.8594 },
  { name: "Leh", lat: 34.1526, lng: 77.5771 },
];

export const PLACES: Place[] = [...DELHI_NCR_PLACES, ...CITY_PLACES, ...REMOTE_PLACES];
