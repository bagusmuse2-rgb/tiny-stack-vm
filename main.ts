// Tiny stack VM: a from-scratch interpreter of make.fun's tiny stack ISA v1.
// One run answers every instance in /input (or $MAKEFUN_INPUT_DIR) into /output.
// Rules followed, in the reference VM's order: step limit (trap 10), pc range
// (trap 9), unknown opcode (trap 5), truncated immediate (trap 9), stack
// underflow (2) / overflow (3), then the instruction's own traps and effect.
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
// Per opcode byte: (immediate bytes | pops<<3 | pushes<<5) + 1; 0 = no opcode.
// Index is the byte value; the table mirrors the reference VM's opcode table.
const T="\u0001\"%\tIQqy\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u00001111111)111)111\u0000111\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0003\u000b\u000b\u0003\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000)\u0011\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\t\t!\t";
function run(p,q){
  const D=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),o=new Uint8Array(65536);
  let s=0,c=0,pc=0,n=0,ip=0,ol=0;
  const end=x=>({o:o.slice(0,ol),c:x});
  for(;;){
    if(n===1e6)return end(10);
    if(pc<0||pc>=p.length)return end(9);
    const op=p[pc],t=T.charCodeAt(op);
    if(!t)return end(5);
    const e=t-1,im=e&7,pp=(e>>3)&3,pu=(e>>5)&3;
    if(pc+im>=p.length)return end(9);
    n++;
    const nx=pc+1+im;
    if(s<pp)return end(2);
    if(s-pp+pu>256)return end(3);
    pc=nx;
    switch(op){
      case 0:return end(0);
      case 1:D[s++]=(p[nx-1]<<24)>>24;break;
      case 2:D[s++]=p[nx-4]|p[nx-3]<<8|p[nx-2]<<16|p[nx-1]<<24;break;
      case 3:s--;break;
      case 4:D[s]=D[s-1];s++;break;
      case 5:{const v=D[s-1];D[s-1]=D[s-2];D[s-2]=v;break;}
      case 6:D[s]=D[s-2];s++;break;
      case 7:{const a=D[s-3];D[s-3]=D[s-2];D[s-2]=D[s-1];D[s-1]=a;break;}
      case 0x17:D[s-1]=-D[s-1]|0;break;
      case 0x1b:D[s-1]=~D[s-1];break;
      case 0x30:case 0x31:case 0x32:{
        const r=((p[nx-2]|p[nx-1]<<8)<<16)>>16;
        let k=1;
        if(op!==0x30){const v=D[--s];k=op===0x31?v===0:v!==0;}
        if(k)pc=nx+r;
        break;}
      case 0x33:
        if(c===64)return end(7);
        C[c++]=nx;pc=p[nx-2]|p[nx-1]<<8;break;
      case 0x34:
        if(!c)return end(8);
        pc=C[--c];break;
      case 0x40:{const a=D[s-1];if(a<0||a>255)return end(6);D[s-1]=M[a];break;}
      case 0x41:{const a=D[s-1],v=D[s-2];if(a<0||a>255)return end(6);s-=2;M[a]=v;break;}
      case 0x50:{const b=Buffer.from(String(D[s-1]));if(ol+b.length>65536)return end(11);o.set(b,ol);ol+=b.length;s--;break;}
      case 0x51:if(ol+1>65536)return end(11);o[ol++]=D[--s]&255;break;
      case 0x52:D[s++]=ip<q.length?q[ip++]:-1;break;
      case 0x53:return end(D[--s]&255);
      default:{
        const b=D[s-1],a=D[s-2];let r;
        if(op===0x10)r=a+b|0;
        else if(op===0x11)r=a-b|0;
        else if(op===0x12)r=Math.imul(a,b);
        else if(op===0x13){if(!b)return end(4);r=a/b|0;}
        else if(op===0x14){if(!b)return end(4);r=a%b|0;}
        else if(op===0x15){if(!b)return end(4);r=Math.floor((a>>>0)/(b>>>0))|0;}
        else if(op===0x16){if(!b)return end(4);r=(a>>>0)%(b>>>0)|0;}
        else if(op===0x18)r=a&b;
        else if(op===0x19)r=a|b;
        else if(op===0x1a)r=a^b;
        else if(op===0x1c)r=a<<b;
        else if(op===0x1d)r=a>>b;
        else if(op===0x1e)r=a>>>b|0;
        else if(op===0x20)r=a===b?1:0;
        else if(op===0x21)r=a<b?1:0;
        else r=a>>>0<b>>>0?1:0;
        s-=2;D[s++]=r;
      }
    }
  }
}
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of readdirSync(I).sort()){
  const r=run(readFileSync(join(I,id,'program.bin')),readFileSync(join(I,id,'input.bin')));
  mkdirSync(join(O,id),{recursive:true});
  writeFileSync(join(O,id,'stdout.bin'),r.o);
  writeFileSync(join(O,id,'exit.txt'),r.c+'\n');
}
