import { apiServerUrl } from "@/lib/api-config";
const API_BASE = apiServerUrl();

                            
              
                  
              
             
               
 

export async function getHealth()                     {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json()                      ;
}
