import { useEffect, useState } from 'react';
import { checkHealth, getConnection, subscribeConnection } from '../api/client';

/** Shows a banner when the backend, MongoDB or the Python AI service is not reachable. */
export default function ConnectionBanner() {
 const [conn, setConn] = useState(getConnection());

 useEffect(() => {
 const unsub = subscribeConnection(setConn);
 checkHealth();
 const timer = setInterval(checkHealth, 15000);
 return () => { unsub(); clearInterval(timer); };
 }, []);

 if (conn.backend === false) {
 return (
 <div className="connection-banner danger" role="alert">
 <strong> Backend not connected.</strong> The Express server on <code>localhost:5000</code> is not responding.
 Start everything with <code>npm run dev</code> in the project folder.
 <button type="button" onClick={checkHealth}>Retry</button>
 </div>
 );
 }
 if (conn.backend && conn.database === false) {
 return (
 <div className="connection-banner danger" role="alert">
 <strong> MongoDB not connected.</strong> Start MongoDB (Windows: <code>net start MongoDB</code>). The server reconnects automatically.
 <button type="button" onClick={checkHealth}>Retry</button>
 </div>
 );
 }
 if (conn.backend && conn.aiService === false) {
 return (
 <div className="connection-banner warning" role="status">
 <strong>AI service offline.</strong> Symptom checker and disease models need the Python service (<code>npm run ai</code>). Everything else works.
 <button type="button" onClick={checkHealth}>Retry</button>
 </div>
 );
 }
 return null;
}
