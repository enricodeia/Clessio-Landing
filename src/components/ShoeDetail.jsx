import { useState, useEffect } from 'react';

const SHOE_NAMES = [
  'Air Max 90','Air Jordan 1 Low','Dunk High Retro','Air Force 1','Blazer Mid',
  'Air Max 97','Jordan 4 Retro','Dunk Low','Air Max Plus','Air Huarache',
  'Jordan 11 Retro','Air Max 95','Dunk SB Low','Jordan 3 Retro','Air Presto',
  'Air Max 1','Jordan 12 Retro','Cortez','Air Max 270','Jordan 1 Mid',
  'Air Rift','Vapormax','Jordan 5 Retro','Air Max 98','React Element',
  'Waffle One','Jordan 6 Retro','Air Tailwind','ZoomX Vaporfly','Pegasus',
  'Jordan 13 Retro','Dunk Mid','Air Zoom Spiridon','Air Max 200','Jordan 7',
  'Air Trainer 1','Killshot','Air Max Dawn','Jordan 2 Retro','Air Monarch',
  'Daybreak','Air Woven','Jordan 8 Retro','React Infinity','Air Max Furyosa',
  'Zoom Fly','Jordan 9 Retro','Air Ghost Racer','Air Streak Lite','Metcon',
  'Jordan 10 Retro','Air Mowabb','Venture Runner','Air Max Excee','Wildhorse',
  'Zoom Alphafly','Air Max SC','Downshifter','Free Run','Revolution',
];

const SIZES = ['38','39','40','41','42','43','44','45'];

export default function ShoeDetail({ activeIndex, onClose }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeIndex !== null) {
      setSelectedSize(null);
      // Delay to let 3D animate first
      const id = setTimeout(() => setVisible(true), 150);
      return () => clearTimeout(id);
    } else {
      setVisible(false);
    }
  }, [activeIndex]);

  if (activeIndex === null) return null;

  const name = SHOE_NAMES[activeIndex] || `Shoe ${activeIndex + 1}`;

  return (
    <div className={`shoe-detail${visible ? ' shoe-detail--visible' : ''}`}>
      <button className="shoe-detail__close" onClick={onClose}>✕</button>
      <div className="shoe-detail__info">
        <h2 className="shoe-detail__name">{name}</h2>
        <div className="shoe-detail__sizes">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`shoe-detail__size${selectedSize === s ? ' shoe-detail__size--active' : ''}`}
              onClick={() => setSelectedSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <a
          href="https://progetto01-clessio.typeform.com/to/G7Gx2uBF?typeform-source=clessiolab.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shoe-detail__cta"
        >
          Richiedi Scarpa
        </a>
      </div>
    </div>
  );
}
