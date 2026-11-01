'use client'

import { useState } from "react";

const items = Array.from({ length: 10_000}, (_, i) => ({
  id: Math.random().toString(36).slice(2),
  text: String(i),
}));

const itemHeight = 40
const containerHeight = 600

export default function Home() {
  const [listItems, setListItems] = useState(items)
  return (
    <div style={{ padding: '0 12px' }}>
      <h1>Virtualized List</h1>
      <div style = {{marginBottom: 12}}>
        <button onClick = {() => setListItems((items) => items.slice().reverse())}>Reverse List</button>
      </div>
      <div style = {{height: containerHeight, overflow: 'auto', border: '1px solid lightgray'}}>
        {listItems.map((item, index) => {
          return (
            <div style = {{ height: itemHeight, padding: '6px 12px'}} key = {item.id}>
              {item.text}
            </div>
          )
        })}
      </div>
    </div>
  );
}