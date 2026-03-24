import { useState } from 'react';

export default function WKBDecoder() {
  const [wkb, setWkb] = useState('0101000020E61000008F368E588B8FF23FAA81E673EE884640');
  const [result, setResult] = useState(null);

  const decodeWKB = (hexString) => {
    try {
      // Supprimer les espaces
      const hex = hexString.trim().replace(/\s/g, '');
      
      // Vérifier si c'est du hex valide
      if (!/^[0-9A-Fa-f]*$/.test(hex)) {
        setResult({ error: 'Format hexadécimal invalide' });
        return;
      }

      // Convertir hex en bytes
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }

      // Lire byte order (0=big-endian, 1=little-endian)
      const byteOrder = bytes[0];
      const view = new DataView(bytes.buffer);

      // Lire type de géométrie
      let wkbType = view.getUint32(1, byteOrder === 1);
      
      // Masquer les flags hauts pour obtenir le type de base
      wkbType = wkbType & 0xFF;

      // Lire coordonnées (offset 5 pour Point)
      let lon, lat, srid;

      if (wkbType === 1) { // Point
        // Vérifier si SRID est inclus (flag 0x20000000)
        const hasSRID = view.getUint32(1, byteOrder === 1) & 0x20000000;
        
        let offset = 5;
        if (hasSRID) {
          srid = view.getUint32(offset, byteOrder === 1);
          offset += 4;
        }

        lon = view.getFloat64(offset, byteOrder === 1);
        lat = view.getFloat64(offset + 8, byteOrder === 1);

        // Trouver nom de lieu approximatif
        let location = 'Lieu inconnu';
        
        // France: latitude 42-51, longitude -5 à 8
        if (lat > 42 && lat < 51 && lon > -5 && lon < 8) {
          // Approximations françaises
          if (lat > 48 && lon > 2) location = '📍 Paris/Île-de-France';
          else if (lat > 43 && lon > 7) location = '📍 Provence/Côte d\'Azur';
          else if (lat > 47 && lon < 2) location = '📍 Ouest (Loire/Bretagne)';
          else if (lat > 45 && lon < 2) location = '📍 Nouvelle-Aquitaine';
          else if (lat > 45 && lon > 2) location = '📍 Centre/Massif Central';
          else if (lat > 43 && lon > 2) location = '📍 Occitanie';
          else if (lat > 47 && lon > 2) location = '📍 Bourgogne/Centre';
          else location = '📍 Quelque part en France';
        }

        setResult({
          success: true,
          type: 'Point',
          longitude: lon.toFixed(6),
          latitude: lat.toFixed(6),
          srid: srid || 'Non spécifié',
          location: location,
          mapUrl: `https://www.openstreetmap.org/?lat=${lat}&lon=${lon}&zoom=12`
        });
      } else {
        setResult({ error: `Type de géométrie non supporté: ${wkbType}` });
      }
    } catch (err) {
      setResult({ error: `Erreur: ${err.message}` });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🗺️ WKB Decoder</h1>
        <p className="text-gray-600 mb-6">Décode les géométries PostGIS (format hexadécimal)</p>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Entrez une chaîne WKB (hexadécimal):
          </label>
          <textarea
            value={wkb}
            onChange={(e) => setWkb(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-mono text-sm mb-4 focus:outline-none focus:border-indigo-500"
            rows="3"
          />
          <button
            onClick={() => decodeWKB(wkb)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            🔍 Décoder
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {result.error ? (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
                <p className="font-bold">❌ Erreur</p>
                <p>{result.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
                  <p className="font-bold">✅ Décodage réussi!</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 font-semibold">Type de géométrie</p>
                    <p className="text-lg font-bold text-indigo-600">{result.type}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 font-semibold">SRID</p>
                    <p className="text-lg font-bold text-indigo-600">{result.srid}</p>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
                  <p className="text-sm text-indigo-600 font-semibold mb-2">📍 Coordonnées GPS</p>
                  <div className="space-y-2 font-mono text-sm">
                    <p className="text-gray-800"><span className="font-bold">Latitude:</span> {result.latitude}°</p>
                    <p className="text-gray-800"><span className="font-bold">Longitude:</span> {result.longitude}°</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <p className="text-lg font-bold text-blue-700 mb-2">{result.location}</p>
                  <a
                    href={result.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                  >
                    📍 Voir sur OpenStreetMap
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}