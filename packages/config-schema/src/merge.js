/** Plain-object deep merge — used to apply a partial config patch onto a stored config. */
export function deepMerge   (base   , patch         )    {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch     ));
  }
  const out                          = { ...(base                           ) };
  for (const [key, value] of Object.entries(patch                           )) {
    const current = (base                           )[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out     ;
}

function isPlainObject(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
