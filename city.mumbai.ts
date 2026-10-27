/**
 * Mumbai — the Byculla–Parel–Dadar corridor.
 *
 * SIMULATION ONLY. The basemap geometry is real OpenStreetMap data, but the
 * stations below are placed for the demo. They are near their real-world
 * namesakes and are not a statement about actual facilities, actual fleet
 * composition, or actual response capacity. See productSpec.md §17.
 *
 * Swapping cities is this file plus a new .pmtiles extract.
 */

import type { CityConfig, Department, UnitType } from '@sim/shared';

export interface UnitSeed {
  id: string;
  department: Department;
  type: UnitType;
  stationId: string;
}

export const mumbai: CityConfig = {
  id: 'mumbai',
  name: 'Mumbai — Byculla to Dadar',
  bbox: [72.818, 18.968, 72.868, 19.032],
  mapBbox: [72.79, 18.95, 72.90, 19.05],
  center: { lat: 19.0, lng: 72.843 },
  zoom: 13.0,
  stations: [
    { id: 'FS-BYC', name: 'Byculla Fire Station', department: 'FIRE', position: { lat: 18.9772, lng: 72.8324 } },
    { id: 'FS-DAD', name: 'Dadar Fire Station', department: 'FIRE', position: { lat: 19.0189, lng: 72.8438 } },
    { id: 'HOS-KEM', name: 'KEM Hospital, Parel', department: 'MEDICAL', position: { lat: 19.0009, lng: 72.8423 } },
    { id: 'HOS-SHU', name: 'Shushrusha Hospital, Dadar', department: 'MEDICAL', position: { lat: 19.0245, lng: 72.8422 } },
    { id: 'PS-BYC', name: 'Byculla Police Station', department: 'POLICE', position: { lat: 18.9784, lng: 72.834 } },
    { id: 'PS-DAD', name: 'Dadar Police Station', department: 'POLICE', position: { lat: 19.0181, lng: 72.8465 } },
  ],
  gazetteer: [
    { label: 'Byculla', lat: 18.9784, lng: 72.8318 },
    { label: 'Mazgaon', lat: 18.9678, lng: 72.8447 },
    { label: 'Rey Road', lat: 18.9767, lng: 72.8424 },
    { label: 'Chinchpokli', lat: 18.9847, lng: 72.8331 },
    { label: 'Kalachowki', lat: 18.9847, lng: 72.8444 },
    { label: 'Lalbaug', lat: 18.9925, lng: 72.8329 },
    { label: 'Currey Road', lat: 18.9936, lng: 72.8331 },
    { label: 'Parel', lat: 18.9976, lng: 72.8376 },
    { label: 'Bhoiwada', lat: 19.0031, lng: 72.8404 },
    { label: 'Sewri', lat: 18.9946, lng: 72.8555 },
    { label: 'Naigaon', lat: 19.0089, lng: 72.8368 },
    { label: 'Hindmata Junction', lat: 19.0093, lng: 72.8412 },
    { label: 'Dadar', lat: 19.0176, lng: 72.8446 },
    { label: 'Dadar TT Circle', lat: 19.0209, lng: 72.8493 },
    { label: 'Prabhadevi', lat: 19.0166, lng: 72.8296 },
    { label: 'Shivaji Park', lat: 19.0281, lng: 72.8382 },
  ],
};

/**
 * Eleven units, total, across three departments.
 *
 * The count is a demo requirement, not a shortcut: eleven chevrons stay
 * individually trackable on a projector, scarcity arrives early enough to be
 * felt, and exactly one RESCUE unit means the collapse beat has precisely one
 * right answer. See productSpec.md §13.
 */
export const mumbaiFleet: UnitSeed[] = [
  { id: 'E-01', department: 'FIRE', type: 'ENGINE', stationId: 'FS-BYC' },
  { id: 'E-02', department: 'FIRE', type: 'ENGINE', stationId: 'FS-DAD' },
  { id: 'L-01', department: 'FIRE', type: 'LADDER', stationId: 'FS-BYC' },
  { id: 'RSQ-1', department: 'FIRE', type: 'RESCUE', stationId: 'FS-DAD' },

  { id: 'AMB-01', department: 'MEDICAL', type: 'AMBULANCE', stationId: 'HOS-KEM' },
  { id: 'AMB-02', department: 'MEDICAL', type: 'AMBULANCE', stationId: 'HOS-KEM' },
  { id: 'AMB-03', department: 'MEDICAL', type: 'AMBULANCE', stationId: 'HOS-SHU' },
  { id: 'MCI-1', department: 'MEDICAL', type: 'MCI', stationId: 'HOS-KEM' },

  { id: 'PTL-01', department: 'POLICE', type: 'PATROL', stationId: 'PS-BYC' },
  { id: 'PTL-02', department: 'POLICE', type: 'PATROL', stationId: 'PS-DAD' },
  { id: 'TRF-1', department: 'POLICE', type: 'TRAFFIC', stationId: 'PS-DAD' },
];
