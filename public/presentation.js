// Forms share one presentation contract: a real page on mobile, a dialog on desktop.
// The mobile host is a section inside the active main; it never enters the top layer.
export function createPresentation(dialog, { mobile, mount, closed }) {
 let page = null;
 const current = () => page?.isConnected ? page : dialog;
 const ensure = () => {
  if (!mobile()) return dialog;
  if (!page?.isConnected) {
   dialog.close();
   dialog.innerHTML = '';
   page = mount();
  }
  return page;
 };
 return {
  get element() { return current(); },
  get isPage() { return Boolean(page?.isConnected); },
  get open() { return Boolean(page?.isConnected) || dialog.open; },
  get innerHTML() { return current().innerHTML; },
  set innerHTML(value) {
   // Clearing a closed presentation must not create a new page during logout/save.
   if (value === '' && !page?.isConnected && !dialog.open) dialog.innerHTML = '';
   else ensure().innerHTML = value;
  },
  get scrollTop() { return current().scrollTop; },
  set scrollTop(value) { current().scrollTop = value; },
  querySelector(selector) { return current().querySelector(selector); },
  querySelectorAll(selector) { return current().querySelectorAll(selector); },
  append(...nodes) { current().append(...nodes); },
  showModal() {
   if (mobile()) ensure();
   else if (!dialog.open) dialog.showModal();
  },
  close() {
   if (page) { page.remove(); page = null; closed?.(); }
   if (dialog.open) dialog.close();
  }
 };
}
