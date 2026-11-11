import {z} from "zod";
export const registrationSchema=z.object({
 season_id:z.uuid(),
 display_name:z.string().trim().min(2).max(100),
 position:z.enum(["C","LW","RW","D","G","F"]),
 document_ids:z.array(z.uuid()).min(1),
 signer_name:z.string().trim().min(2).max(100),
 consent_public_profile:z.enum(["yes","no"]),
 consent_filming:z.enum(["yes","no"]),
 consent_marketing:z.enum(["yes","no"]),
});
export const documentUploadSchema=z.object({
 season_id:z.uuid(),
 document_id:z.uuid(),
 document_type:z.enum(["waiver","code_of_conduct"]),
 title:z.string().trim().min(2).max(120),
 object_path:z.string().min(1).max(200),
 file_name:z.string().trim().min(1).max(160),
});
export const decisionSchema=z.object({registration_id:z.uuid(),decision:z.enum(["approved","rejected","withdrawn"]),revision:z.coerce.number().int().positive(),reason:z.string().trim().min(3).max(500)});
export const publicationSchema=z.object({season_id:z.uuid(),enabled:z.enum(["true","false"]),revision:z.coerce.number().int().positive()});
export const openSeasonsSchema=z.array(z.object({season_id:z.string(),league_name:z.string(),season_name:z.string(),opens:z.string(),closes:z.string()}));
export type OpenSeason=z.infer<typeof openSeasonsSchema>[number];
