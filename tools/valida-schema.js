/* Validador mínimo de JSON Schema (subconjunto usado em dados/*.schema.json), sem dependências.
   Suporta: type (inclusive lista), required, properties, additionalProperties (esquema), items, enum, minimum, maximum,
   pattern, allOf e $ref local (#/$defs/...). Funciona no Node e no navegador. Devolve a lista de erros (vazia = válido). */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(); else root.ValidaSchema = factory();
})(this, function(){
'use strict';
function tipoDe(v){ if(v === null) return 'null'; if(Array.isArray(v)) return 'array'; if(typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'; return typeof v; }
function confereTipo(v, t){ const real = tipoDe(v); return real === t || (t === 'number' && real === 'integer'); }

function validar(dado, schema, raiz, caminho, erros){
  raiz = raiz || schema; caminho = caminho || '$'; erros = erros || [];
  if(schema.$ref){
    const alvo = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o && o[k], raiz);
    if(!alvo){ erros.push(`${caminho}: $ref não encontrado (${schema.$ref})`); return erros; }
    return validar(dado, alvo, raiz, caminho, erros);
  }
  if(schema.allOf) for(const s of schema.allOf) validar(dado, s, raiz, caminho, erros);
  if(schema.type){ const ts = [].concat(schema.type); if(!ts.some(t => confereTipo(dado, t))){ erros.push(`${caminho}: esperado ${ts.join(' ou ')}, veio ${tipoDe(dado)}`); return erros; } }
  if(schema.enum && !schema.enum.some(e => e === dado)) erros.push(`${caminho}: valor ${JSON.stringify(dado)} fora de ${JSON.stringify(schema.enum)}`);
  if(typeof dado === 'number'){
    if(schema.minimum !== undefined && dado < schema.minimum) erros.push(`${caminho}: ${dado} abaixo do mínimo ${schema.minimum}`);
    if(schema.maximum !== undefined && dado > schema.maximum) erros.push(`${caminho}: ${dado} acima do máximo ${schema.maximum}`);
  }
  if(typeof dado === 'string' && schema.pattern && !new RegExp(schema.pattern).test(dado)) erros.push(`${caminho}: "${dado}" não segue ${schema.pattern}`);
  if(Array.isArray(dado) && schema.items) dado.forEach((x, i) => validar(x, schema.items, raiz, `${caminho}[${i}]`, erros));
  if(dado && typeof dado === 'object' && !Array.isArray(dado)){
    for(const k of (schema.required || [])) if(!(k in dado)) erros.push(`${caminho}: falta "${k}"`);
    const props = schema.properties || {};
    for(const [k, v] of Object.entries(dado)){
      if(props[k]) validar(v, props[k], raiz, `${caminho}.${k}`, erros);
      else if(schema.additionalProperties && typeof schema.additionalProperties === 'object') validar(v, schema.additionalProperties, raiz, `${caminho}.${k}`, erros);
    }
  }
  return erros;
}
return {validar};
});
