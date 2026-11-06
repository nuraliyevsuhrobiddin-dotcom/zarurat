import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPresentation} from '../public/presentation.js';

function fixture(initialMobile=true){
 let mobile=initialMobile,mounts=0,closed=0;
 const dialog={innerHTML:'',open:false,scrollTop:0,
  showModal(){this.open=true;},close(){this.open=false;},
  querySelector(selector){return this.innerHTML.includes(selector)?{owner:'dialog'}:null;},
  querySelectorAll(){return [];},append(){}};
 const pages=[];
 const presentation=createPresentation(dialog,{mobile:()=>mobile,mount(){
  mounts++;
  const page={innerHTML:'',isConnected:true,scrollTop:0,
   remove(){this.isConnected=false;},
   querySelector(selector){return this.innerHTML.includes(selector)?{owner:'page'}:null;},
   querySelectorAll(){return [];},append(){}};
  pages.push(page);return page;
 },closed(){closed++;}});
 return {presentation,dialog,pages,setMobile(value){mobile=value;},get mounts(){return mounts;},get closed(){return closed;}};
}

test('mobile forms use a connected page and never open the desktop dialog',()=>{
 const f=fixture();
 f.dialog.innerHTML='obsolete-form';f.dialog.open=true;
 f.presentation.innerHTML='request-form';f.presentation.showModal();
 assert.equal(f.mounts,1);
 assert.equal(f.dialog.open,false);
 assert.equal(f.dialog.innerHTML,'');
 assert.equal(f.presentation.open,true);
 assert.equal(f.presentation.isPage,true);
 assert.equal(f.presentation.querySelector('request-form').owner,'page');
 f.presentation.innerHTML='success-number';
 assert.equal(f.mounts,1,'success replaces the existing page instead of duplicating forms');
 assert.equal(f.presentation.querySelector('request-form'),null);
 assert.equal(f.presentation.innerHTML,'success-number');
});

test('closing a page invalidates old forms and cleanup does not create a fresh page',()=>{
 const f=fixture();
 f.presentation.innerHTML='register-form';
 const old=f.pages[0];
 f.presentation.close();f.presentation.innerHTML='';
 assert.equal(old.isConnected,false);
 assert.equal(f.presentation.open,false);
 assert.equal(f.presentation.isPage,false);
 assert.equal(f.presentation.querySelector('register-form'),null);
 assert.equal(f.closed,1);
 assert.equal(f.mounts,1,'logout and save cleanup must not remount a presentation');
 f.presentation.close();
 assert.equal(f.closed,1,'repeated close is idempotent');
});

test('navigation discarding a mobile host makes pending connected-element guards fail',()=>{
 const f=fixture();
 f.presentation.innerHTML='account-loading';
 f.pages[0].isConnected=false;
 assert.equal(f.presentation.open,false);
 assert.equal(f.presentation.isPage,false);
 assert.equal(f.presentation.querySelector('account-loading'),null);
 f.presentation.innerHTML='next-form';
 assert.equal(f.mounts,2);
 assert.equal(f.presentation.innerHTML,'next-form');
 assert.equal(f.pages[0].isConnected,false);
});

test('desktop keeps native dialog lifecycle and viewport transitions use one host',()=>{
 const f=fixture(false);
 f.presentation.innerHTML='login-form';
 assert.equal(f.presentation.open,false,'writing markup must not open a desktop modal');
 f.presentation.showModal();
 assert.equal(f.dialog.open,true);
 assert.equal(f.presentation.querySelector('login-form').owner,'dialog');
 assert.equal(f.mounts,0);
 f.presentation.close();f.setMobile(true);
 f.presentation.innerHTML='request-form';
 assert.equal(f.presentation.isPage,true);
 assert.equal(f.dialog.open,false);
 f.presentation.close();f.setMobile(false);
 f.presentation.innerHTML='request-form';f.presentation.showModal();
 assert.equal(f.presentation.isPage,false);
 assert.equal(f.dialog.open,true);
 assert.equal(f.mounts,1);
});
