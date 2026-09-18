// CORS necessaire uniquement parce que ces fonctions sont appelees depuis un
// navigateur (apps/web). La vraie frontiere de securite reste le controle de
// role fait dans chaque fonction via le JWT ; CORS ne fait que determiner
// quelles pages web ont le droit d'appeler l'API depuis un navigateur.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
