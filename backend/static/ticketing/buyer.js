/* Buyer capabilities stay in this tab and private request headers, never links. */
(async()=>{
  const root=document.getElementById('buyer'),slug=root.dataset.eventSlug,id=root.dataset.commerceEventId;
  const prefix='/api/v1/commerce/events/'+encodeURIComponent(slug)+'/',storageKey='hoy-local-ticket:'+id;
  const el=id=>document.getElementById(id),notice=el('notice');
  let meta=null,order=null,busy=false,blobs=[];
  let saved={};
  try {saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}');} catch {saved={};}
  const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify(saved));}catch{throw new Error('Private recovery could not be saved in this tab. Enable browser storage before reserving tickets.');}};
  const say=(text,type='')=>{notice.textContent=text;notice.className=type;};
  const csrf=()=>document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)||'';
  const messages={commerce_unavailable:'The ticket service is unavailable. Your existing reservation details are kept in this tab. Try again shortly.',provider_unavailable:'The simulated checkout is unavailable. Refresh the order before trying again.',insufficient_capacity:'There are no longer enough tickets available for this selection. Try availability again.',order_expired:'The reservation has expired. Payment has not been confirmed.',invalid_order_token:'These recovery details could not be verified.',order_not_found:'This order could not be found.',order_token_required:'Enter the private recovery details for this order.',local_staff_session_required:'The local test session needs renewal before simulated payment. Your order is kept. Ask the local administrator to renew the session.',synthetic_provider_required:'This checkout is unavailable because the service is not in local simulation mode.',order_not_payable:'The order cannot enter checkout. Refresh its confirmed status.',event_cancelled:'Sales are closed for this event.',event_not_available:'Sales are closed for this event.',invalid_request:'Check the ticket selection and test email.',invalid_email:'Enter a valid test email.'};
  const request=async(path,{method='GET',body,privateOrder=false,key,svg=false}={})=>{
    const headers={Accept:svg?'image/svg+xml':'application/json'};
    if(method!=='GET')headers['X-CSRFToken']=csrf();
    if(body!==undefined)headers['Content-Type']='application/json';
    if(privateOrder)headers['X-Order-Token']=saved.token||'';
    if(key)headers['Idempotency-Key']=key;
    const response=await fetch(prefix+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'same-origin',redirect:'error'});
    if(!response.ok){let code='';try{code=(await response.json()).code||'';}catch{}const error=new Error(messages[code]||'The request could not be confirmed. Keep this tab open and retry or refresh your order.');error.code=code;throw error;}
    return svg?response.blob():response.json();
  };
  const money=(minor,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(minor/100);
  const setBusy=value=>{busy=value;root.querySelectorAll('button,input,select').forEach(x=>x.disabled=value);};
  const endpoint=(suffix='')=>'orders/'+encodeURIComponent(saved.orderId)+'/'+suffix;
  const clearQR=()=>{blobs.forEach(URL.revokeObjectURL);blobs=[];el('tickets').replaceChildren();};
  const markStep=index=>['step-reserve','step-checkout','step-confirm'].forEach((name,i)=>el(name).classList.toggle('active',i===index));
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const renderOrder=async()=>{
    el('reserve-form').hidden=true;el('pending').hidden=true;el('order-panel').hidden=false;el('retry-load').hidden=true;
    const paid=order.status==='paid',held=order.status==='held';
    el('order-heading').textContent=paid?'Simulated payment confirmed':held?'Your tickets are on hold':order.refund_required?'Payment requires review':'Reservation status';
    el('order-summary').textContent=money(order.total_minor,order.currency)+' · '+order.items.reduce((sum,i)=>sum+i.quantity,0)+' ticket(s) · '+(paid?'No real payment or admission.':order.status);
    el('hold').textContent=held?'Hold expires '+new Date(Number(order.expires_at)*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'. Payment has not been confirmed.':paid?'Confirmed by the ticket service. This is a local simulation.':'No valid paid admission is established by this page.';
    el('order-id').textContent='Order reference '+order.id;el('private-order').value=saved.orderId||'';el('private-token').value=saved.token||'';
    el('checkout').hidden=!held||!!saved.reference;el('simulate').hidden=!held||!saved.reference;
    markStep(paid?2:1);clearQR();
    if(paid){
      say('Simulated payment confirmed by the order API. These tickets are not valid for admission.','success');
      for(const ticket of order.tickets){
        const card=node('article',undefined,'ticket');card.dataset.ticketId=ticket.id;
        card.append(node('b','House of Young'),node('small','Event organizer','fine'),node('span',el('buyer').querySelector('h1').textContent),node('span','SIMULATION · NOT VALID FOR ENTRY','invalid'),node('small','Ticket reference '+ticket.id,'fine'),node('small','Ticket status: '+ticket.status,'fine'),node('small','Ticketing by Nocheva','ticket-platform'));
        el('tickets').append(card);
        if(ticket.status==='valid'){
          const blob=await request(endpoint('tickets/'+encodeURIComponent(ticket.id)+'/qr.svg'),{privateOrder:true,svg:true});
          const src=URL.createObjectURL(blob);blobs.push(src);const img=node('img');img.src=src;img.alt='Simulated ticket QR; not valid for admission';card.insertBefore(img,card.querySelector('.invalid'));
        }
      }
    }
  };
  const recover=async()=>{
    order=await request(endpoint(),{privateOrder:true});
    if(order.event_id!==id)throw new Error('This recovery belongs to another event.');
    saved.reference=order.provider_reference||null;persist();await renderOrder();
    if(order.status==='held')say(saved.reference?'Simulated checkout is ready. No payment has been confirmed.':'Reservation recovered from the ticket service. Payment has not been confirmed.');
  };
  const updateTotal=()=>{
    if(!meta)return;const tier=meta.tiers.find(t=>t.id===el('tier').value),quantity=Number(el('quantity').value);
    el('total').textContent=tier?money(tier.price_minor*quantity,meta.currency)+' · simulated amount':'';
  };
  const load=async()=>{
    meta=await request('');
    if(saved.orderId&&saved.token){await recover();return;}
    if(saved.pending){el('pending').hidden=false;el('reserve-form').hidden=true;say('A reservation response was interrupted. Retry the original request to recover its outcome.');return;}
    if(meta.state!=='available'){el('reserve-form').hidden=true;el('retry-load').hidden=false;say(meta.state==='unavailable'?'Live ticket availability is unavailable. No stock or price is assumed.':meta.state==='cancelled'?'Sales are closed for this event.':'No tickets are currently available.','error');return;}
    el('tier').replaceChildren();for(const t of meta.tiers.filter(t=>t.available>0)){const option=node('option',t.name+' · '+money(t.price_minor,meta.currency)+' · '+t.available+' available');option.value=t.id;el('tier').append(option);}
    el('reserve-form').hidden=false;el('retry-load').hidden=true;markStep(0);updateTotal();say(meta.available+' tickets available from the local ticket service. Prices and terms are synthetic.');
  };
  const act=async(fn)=>{
    if(busy)return;setBusy(true);
    try{await fn();}catch(error){say(error.message||'The request was interrupted. Retry to confirm its outcome.','error');el('retry-load').hidden=!!saved.orderId||!!saved.pending;if(saved.pending){el('pending').hidden=false;el('reserve-form').hidden=true;}}
    finally{setBusy(false);}
  };
  const reserve=async()=>{
    // Persist the exact request BEFORE sending; reload/lost-response retries reuse it.
    if(!saved.pending){saved.pending={key:crypto.randomUUID(),body:{email:el('email').value.trim(),items:[{tier_id:el('tier').value,quantity:Number(el('quantity').value)}]}};persist();}
    const result=await request('orders/',{method:'POST',body:saved.pending.body,key:saved.pending.key});
    if(result.event_id!==id||!result.recovery_token)throw new Error('The reservation could not be verified. Retry the original request.');
    saved={orderId:result.id,token:result.recovery_token,reference:result.provider_reference||null};persist();el('email').value='';order=result;await renderOrder();say('Tickets are temporarily reserved. Payment has not been confirmed.');
  };
  el('reserve-form').addEventListener('submit',e=>{e.preventDefault();act(reserve);});
  el('retry-reserve').addEventListener('click',()=>act(reserve));
  el('retry-load').addEventListener('click',()=>act(load));
  el('tier').addEventListener('change',updateTotal);el('quantity').addEventListener('input',updateTotal);
  el('checkout').addEventListener('click',()=>act(async()=>{
    const result=await request(endpoint('checkout/'),{method:'POST',privateOrder:true});
    if(result.mode!=='simulation')throw new Error('This page accepts only the local simulated checkout.');
    saved.reference=result.reference;persist();await recover();
  }));
  el('simulate').addEventListener('click',()=>act(async()=>{
    await request(endpoint('simulate/'),{method:'POST',privateOrder:true});
    // Read confirmed state again; a successful action response is not the ticket record.
    await recover();
  }));
  el('show-token').addEventListener('click',()=>{const input=el('private-token'),shown=input.type==='password';input.type=shown?'text':'password';el('show-token').textContent=shown?'Hide recovery token':'Show recovery token';});
  el('refresh').addEventListener('click',()=>act(recover));
  el('recover-form').addEventListener('submit',e=>{e.preventDefault();act(async()=>{
    const previous=saved;saved={orderId:el('recover-id').value.trim(),token:el('recover-token').value.trim()};
    try{await recover();el('recover-token').value='';el('recovery').open=false;}catch(error){saved=previous;throw error;}
  });});
  window.addEventListener('pagehide',clearQR);
  await act(load);
})();
