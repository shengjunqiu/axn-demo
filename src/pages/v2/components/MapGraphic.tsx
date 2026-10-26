export function MapGraphic() {
  return (
    <div className="map-placeholder" aria-label="示意地图">
      <svg viewBox="0 0 700 370" role="img">
        <title>救援区域示意地图</title>
        <rect width="700" height="370" fill="#f5f3e9" />
        <g fill="none" stroke="#d8d2e3" strokeWidth="1.4">
          <path d="M0 48L90 66 124 24 209 81 242 52 300 91 366 46 433 68 500 25 580 56 700 29M0 162L98 152 148 111 236 130 279 178 353 120 415 165 499 140 574 178 700 148M0 268L75 292 129 224 238 242 320 207 381 262 450 222 516 275 598 241 700 282M83 0L104 57 68 121 102 178 75 252 129 322 109 370M251 0L222 64 250 120 228 196 280 267 250 370M419 0L440 76 399 142 442 201 418 279 450 370M606 0L580 78 618 131 577 197 609 269 586 370" />
        </g>
        <g fill="none" stroke="#e7cf9b" strokeWidth="3">
          <path d="M30 44Q215 250 651 319M185 0Q213 177 529 370M0 319Q250 113 700 71" />
        </g>
        <path d="M578 0Q630 85 553 159T493 249T583 370" fill="none" stroke="#b7d9ed" strokeWidth="5" />
        <g fontSize="16" fill="#66717b" fontFamily="Microsoft YaHei">
          <text x="81" y="105">兰州市</text>
          <text x="225" y="67">银川市</text>
          <text x="289" y="180">西安市</text>
          <text x="455" y="109">太原市</text>
          <text x="551" y="62">北京市</text>
          <text x="516" y="234">郑州市</text>
          <text x="426" y="326">武汉市</text>
          <text x="548" y="343">南昌市</text>
        </g>
        <g fill="#69819d">
          <circle cx="77" cy="99" r="3" />
          <circle cx="281" cy="174" r="3" />
          <circle cx="508" cy="229" r="3" />
          <circle cx="544" cy="338" r="3" />
        </g>
      </svg>
    </div>
  )
}
