// Fictional AI development imagery, keyed to the existing greenfield catalog only.
const sets={
 'oxford-formal-shirt':['oxford',['Sky Blue','White']],
 'linen-blend-casual-shirt':['linen',['Sand','Olive']],
 'tailored-formal-trousers':['formal',['Charcoal','Black']],
 'everyday-cotton-chinos':['chinos',['Stone','Olive']],
 'selvedge-look-denim':['denim',['Indigo']],
 'utility-cotton-cargo':['cargo',['Sage','Black']],
 'pique-polo-tshirt':['polo',['Ecru','Navy']],
 'essential-crewneck-tee':['tee',['Ash Grey','Black']]
};
export const viewNames=['Front','Back','Side','Fabric detail','On model'];
export function tryOnFor(product,color){
 const uploaded=product.images?.find(im=>im.kind==='tryon'&&im.color===color);
 if(uploaded)return {...uploaded,label:'Garment only · try-on',generated:!!uploaded.generated};
 const set=sets[product.slug];if(!set||!set[1].includes(color))return null;
 return {src:`/media/tryon/${set[0]}-${set[1].indexOf(color)}.webp`,alt:`${product.name}, ${color} — garment-only AI development cutout`,label:'Garment only · AI development',generated:true};
}
export function galleryFor(product,color=product.color||product.variants?.[0]?.color){
 const firstColor=product.variants?.[0]?.color;
 const uploaded=product.images?.filter(im=>im.kind!=='tryon'&&(im.color?im.color===color:color===firstColor))||[];
 const cutout=tryOnFor(product,color);
 if(uploaded.length)return [...uploaded.map((im,i)=>({...im,label:im.label||`Product photo ${i+1}`,generated:!!im.generated})),...(cutout&&!uploaded.includes(cutout)?[cutout]:[])];
 const set=sets[product.slug];if(!set||!set[1].includes(color))return cutout?[cutout]:[];
 const row=set[1].indexOf(color);
 return [...viewNames.map((label,i)=>({src:`/media/catalog/${set[0]}-${row}-${i}.webp`,alt:`${product.name}, ${color} — ${label.toLowerCase()} (AI development image)`,label,generated:true})),...(cutout?[cutout]:[])];
}
export function coverFor(product,color){return galleryFor(product,color)[0];}
export const categoryStories=[
 {name:'Shirts',title:'A sharper perspective.',slug:'oxford-formal-shirt',image:'/media/catalog/oxford-0-4.webp',number:'01'},
 {name:'Formal Pants',title:'Quietly composed.',slug:'tailored-formal-trousers',image:'/media/catalog/formal-0-4.webp',number:'02'},
 {name:'Cotton Pants',title:'Room to move.',slug:'everyday-cotton-chinos',image:'/media/catalog/chinos-0-4.webp',number:'03'},
 {name:'Denim Pants',title:'Character, in denim.',slug:'selvedge-look-denim',image:'/media/catalog/denim-0-4.webp',number:'04'},
 {name:'Cotton Cargo',title:'Utility. Reconsidered.',slug:'utility-cotton-cargo',image:'/media/catalog/cargo-0-4.webp',number:'05'},
 {name:'Polo T-Shirts',title:'Off-duty, elevated.',slug:'pique-polo-tshirt',image:'/media/catalog/polo-0-4.webp',number:'06'},
 {name:'Round-Neck T-Shirts',title:'The everyday foundation.',slug:'essential-crewneck-tee',image:'/media/catalog/tee-0-4.webp',number:'07'}
];
