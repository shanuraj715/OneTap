const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

                            
              
                  
              
             
               
 

export async function getHealth()                     {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json()                      ;
}
