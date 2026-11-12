export const previewSize={width:720,height:960};
export function containRect(width,height,stage=previewSize){const scale=Math.min(stage.width/width,stage.height/height);return {x:(stage.width-width*scale)/2,y:(stage.height-height*scale)/2,width:width*scale,height:height*scale};}
export function poseFromPoints(points,bottom=false){
 if(points.length!==3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Choose three body landmarks');
 const [a,b,c]=points,span=Math.hypot(b.x-a.x,b.y-a.y),top={x:(a.x+b.x)/2,y:(a.y+b.y)/2},length=Math.hypot(c.x-top.x,c.y-top.y);
 if(span<25||length<50||b.x<=a.x||c.y<=top.y)throw new Error('Mark left then right across the photo, and the hem below them. Space the points further apart.');
 const neckAllowance=bottom?0:length*.14;
 return {x:(top.x+c.x)/2/720*100,y:((top.y+c.y)/2-neckAllowance/2)/960*100,width:Math.max(10,Math.min(160,span*(bottom?1.15:1.65)/720*100)),height:Math.max(10,Math.min(140,(length+neckAllowance)/960*100)),rotation:Math.max(-45,Math.min(45,Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI)),waist:1,hem:1,opacity:1};
}
export function defaultPose(bottom=false){return {x:50,y:bottom?66:48,width:bottom?42:72,height:bottom?60:50,rotation:0,waist:1,hem:1,opacity:1};}
export function stripWidth(t,waist,hem){return t<.55?1+(waist-1)*(t/.55):waist+(hem-waist)*((t-.55)/.45);}
