// Request drafts deliberately live only in this page's memory, never browser storage.
const fields = values => ({name:String(values.name??''),phone:String(values.phone??''),description:String(values.description??''),consent:Boolean(values.consent)});
export const requestDraftContext = (category,packageName='',special=false) => JSON.stringify([category,packageName,Boolean(special)]);
export function sameRequestDraftValues(a,b){
 const left=fields(a),right=fields(b);
 return Object.keys(left).every(key=>left[key]===right[key]);
}
export function createRequestDrafts(){
 let owner=null;
 const drafts=new Map();
 return {
  setOwner(nextOwner){if(nextOwner!==owner){drafts.clear();owner=nextOwner;}},
  get(formOwner,context){return formOwner===owner?drafts.get(context)||null:null;},
  save(formOwner,context,values){
   if(formOwner!==owner)return null;
   const previous=drafts.get(context);
   if(previous&&sameRequestDraftValues(previous.values,values))return previous;
   const snapshot=Object.freeze({owner:formOwner,context,values:Object.freeze(fields(values))});
   drafts.set(context,snapshot);return snapshot;
  },
  complete(snapshot){
   if(!snapshot||snapshot.owner!==owner||drafts.get(snapshot.context)!==snapshot)return false;
   drafts.delete(snapshot.context);return true;
  }
 };
}
