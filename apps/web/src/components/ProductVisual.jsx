'use client';
export default function ProductVisual({product,className='',compact=false}){
 const pants=['Formal Pants','Cotton Pants','Denim Pants','Cotton Cargo'].includes(product.category);
 const tee=['Polo T-Shirts','Round-Neck T-Shirts'].includes(product.category);
 return <div className={`product-visual ${className} ${compact?'compact':''}`} style={{'--swatch':product.swatch||'#c1b8a7'}}>
   {product.images?.length?<img className="product-photo" src={product.images[0].src} alt={product.images[0].alt}/>:<><div className="visual-noise"/>
   <div className={`garment ${pants?'pants':tee?'tee':'shirt'}`}><div className="garment-neck"/><div className="garment-placket"/><div className="garment-pocket"/><div className="garment-seam"/></div>
   </>}
   {!compact&&<span className="visual-watermark">TRENDISE / FORM & FUNCTION</span>}
 </div>;
}
