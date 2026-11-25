// 12 Indian cities (incl. Delhi-NCR: Delhi, Noida, Gurugram) per PROJECT_CONTEXT §2
// Coordinates are standard city-centre points (WGS-84).
// ncr: true for National Capital Region cities (GRAP banner applies)

export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  ncr: boolean;
}

export const CITIES: readonly City[] = [
  { id: 'delhi',     name: 'Delhi',       state: 'Delhi',             lat: 28.6139, lon: 77.2090, ncr: true  },
  { id: 'noida',     name: 'Noida',       state: 'Uttar Pradesh',     lat: 28.5355, lon: 77.3910, ncr: true  },
  { id: 'gurugram',  name: 'Gurugram',    state: 'Haryana',           lat: 28.4595, lon: 77.0266, ncr: true  },
  { id: 'mumbai',    name: 'Mumbai',      state: 'Maharashtra',       lat: 19.0760, lon: 72.8777, ncr: false },
  { id: 'kolkata',   name: 'Kolkata',     state: 'West Bengal',       lat: 22.5726, lon: 88.3639, ncr: false },
  { id: 'bengaluru', name: 'Bengaluru',   state: 'Karnataka',         lat: 12.9716, lon: 77.5946, ncr: false },
  { id: 'hyderabad', name: 'Hyderabad',   state: 'Telangana',         lat: 17.3850, lon: 78.4867, ncr: false },
  { id: 'chennai',   name: 'Chennai',     state: 'Tamil Nadu',        lat: 13.0827, lon: 80.2707, ncr: false },
  { id: 'pune',      name: 'Pune',        state: 'Maharashtra',       lat: 18.5204, lon: 73.8567, ncr: false },
  { id: 'ahmedabad', name: 'Ahmedabad',   state: 'Gujarat',           lat: 23.0225, lon: 72.5714, ncr: false },
  { id: 'jaipur',    name: 'Jaipur',      state: 'Rajasthan',         lat: 26.9124, lon: 75.7873, ncr: false },
  { id: 'lucknow',   name: 'Lucknow',     state: 'Uttar Pradesh',     lat: 26.8467, lon: 80.9462, ncr: false },
] as const;

export function getCityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}
