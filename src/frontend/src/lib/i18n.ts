export const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
] as const;

export type Locale = (typeof languages)[number]["code"];
type Translations = readonly [es: string, fr: string, de: string, ja: string];

export function isLocale(value: unknown): value is Locale {
  return languages.some(language => language.code === value);
}

export const musicJourneyCopy = {
  "title": [
    "My Musical Journey",
    "Mi recorrido musical"
  ],
  "subtitle": [
    "A personal history of influences, discoveries, and ways of listening.",
    "Una historia personal de influencias, descubrimientos y formas de escuchar."
  ],
  "intro": [
    [
      "My relationship with music began with electronic music, but over the years it has taken me in directions I never expected to explore. Rock, R&B, jazz, piano, and, more recently, ambient and experimental music have gradually changed the way I listen, compose, and think about sound.",
      "Mi relación con la música comenzó con la electrónica, pero con los años se fue extendiendo hacia lugares que nunca imaginé explorar. El rock, el R&B, el jazz, el piano y, más recientemente, el ambient y la música experimental fueron cambiando mi manera de escuchar, componer y entender el sonido."
    ],
    [
      "These influences never really replaced what I was listening to before. As I discovered new artists and genres, I remained closely connected to electronic music and the different scenes developing around it. Looking back, I see two paths that grew alongside each other: one rooted in my earliest influences, and another shaped by curiosity and personal discoveries.",
      "Sin embargo, estas influencias no llegaron para sustituir lo que escuchaba antes. Mientras descubría nuevos artistas y géneros, seguía muy involucrado con la música electrónica y con las distintas escenas que surgían a su alrededor. Por eso, cuando pienso en mi recorrido, veo dos caminos que avanzaron en paralelo: uno que conserva mis primeras influencias y otro que se fue formando a través de la curiosidad y de los descubrimientos personales."
    ]
  ],
  "chapters": [
    {
      "title": [
        "The early years",
        "Los primeros años"
      ],
      "paragraphs": [
        [
          "I was around 12 years old, finishing fifth grade in Cuba, when I started listening to Skrillex. What caught my attention most were the metallic, mechanical sounds that reminded me of the Transformers movies. There was something fascinating about hearing bass sounds that seemed to move, bend, and transform into something else.",
          "Tenía alrededor de 12 años y estaba terminando el quinto grado en Cuba cuando comencé a escuchar a Skrillex. Lo que más me llamaba la atención de su música eran aquellos sonidos metálicos y mecánicos que me recordaban a las películas de Transformers. Había algo fascinante en escuchar bajos que parecían moverse, deformarse y transformarse en otra cosa."
        ],
        [
          "At the time, I knew very little about music production or synthesis, but those sounds sparked a curiosity that has stayed with me ever since. I enjoyed the energy of the music, but I was also drawn to how strange and distinctive the sounds themselves could be.",
          "En aquel momento no sabía demasiado sobre producción musical ni síntesis, pero esos sonidos despertaron una curiosidad que todavía conservo. Me gustaba la energía de la música, aunque también me interesaba lo extraños y particulares que podían llegar a ser sus timbres."
        ],
        [
          "Between the ages of 13 and 14, I continued exploring that side of electronic music through Zomboy, who introduced me more deeply to British brostep, distorted bass, and the rhythmic structures of dubstep. Around the same time, I was listening to Bring Me the Horizon and other popular artists from those years. BMTH gave me another way to connect with intensity, combining aggressive instrumentation with melodies and vocals that felt much more emotional.",
          "Entre los 13 y 14 años seguí explorando esa vertiente electrónica a través de Zomboy, que me acercó más al brostep británico, a los bajos distorsionados y a las estructuras rítmicas propias del dubstep. Al mismo tiempo, escuchaba a Bring Me the Horizon y a otros artistas populares de aquellos años. BMTH me permitió conectar con una forma diferente de intensidad, donde la agresividad instrumental convivía con melodías y voces mucho más emocionales."
        ]
      ]
    },
    {
      "title": [
        "Adolescence: From sound to songwriting",
        "La adolescencia: del sonido a la canción"
      ],
      "paragraphs": [
        [
          "Around the age of 16, I became more interested in rock and alternative music. I was listening to Linkin Park, Twenty One Pilots, and other artists, and gradually started paying more attention to vocals, lyrics, and how songs developed from one section to another.",
          "Alrededor de los 16 años comencé a interesarme más por el rock y la música alternativa. Escuchaba a Linkin Park y Twenty One Pilots, entre otros artistas, y poco a poco fui prestando más atención a las voces, las letras y la manera en que se desarrollaban las canciones."
        ],
        [
          "Linkin Park felt particularly familiar to me because of their combination of heavy instrumentation, electronic elements, and melodies. Twenty One Pilots introduced me to songwriting that could move between different styles while still maintaining a recognizable identity.",
          "Linkin Park me resultaba especialmente cercano por su combinación de instrumentos pesados, elementos electrónicos y melodías. Twenty One Pilots, por su parte, me acercó a composiciones que podían moverse entre diferentes estilos sin perder una identidad propia."
        ],
        [
          "When I was 17, I started listening to Marshmello more regularly. His music allowed me to enjoy a more melodic, pop-oriented side of electronic music, quite different from the aggressive dubstep that had shaped my earlier years. I also began discovering artists like Post Malone, whose blend of styles and melancholic sensibility expanded my interest in other approaches to popular music.",
          "A los 17 años empecé a escuchar a Marshmello con más frecuencia. Su música me permitió disfrutar de una electrónica más melódica y cercana al pop, diferente del dubstep agresivo que había marcado mis primeros años. También fui descubriendo artistas como Post Malone, cuya mezcla de estilos y sensibilidad melancólica amplió mi interés por otras formas de producir música popular."
        ],
        [
          "Looking back, this was a period when I started paying attention not only to how a production sounded, but also to what a melody, a voice, or an arrangement could communicate.",
          "En retrospectiva, fue una época en la que empecé a interesarme no solo por cómo sonaba una producción, sino también por cómo una melodía, una voz o un arreglo podían transmitir algo."
        ]
      ]
    },
    {
      "title": [
        "An electronic foundation I never left behind",
        "Una raíz electrónica que nunca dejé atrás"
      ],
      "paragraphs": [
        [
          "As my interests expanded into other genres, I continued following electronic music closely. During the pandemic and the years that followed, I spent a lot of time discovering producers, listening to new releases, and exploring communities around dubstep, riddim, melodic dubstep, and color bass.",
          "Mientras mi interés se expandía hacia otros géneros, seguía muy pendiente de la música electrónica. Durante la pandemia y los años posteriores pasé mucho tiempo descubriendo productores, escuchando lanzamientos y explorando distintas comunidades del dubstep, riddim, melodic dubstep y color bass."
        ],
        [
          "Artists such as Dr. Ozi, Soltan, MUST DIE!, Voltra, and Barely Alive kept me interested in aggressive bass sounds, distorted timbres, and the rhythmic possibilities of the genre. Mr. Bill became another important reference, particularly because of his approach to detailed audio manipulation, resampling, and more experimental production techniques.",
          "Artistas como Dr. Ozi, Soltan, MUST DIE!, Voltra y Barely Alive mantuvieron vivo mi interés por los bajos agresivos, los timbres distorsionados y las posibilidades rítmicas del género. Mr. Bill fue otra referencia importante, especialmente por su relación con la manipulación detallada del audio, el resampling y los procesos de producción más experimentales."
        ],
        [
          "I also discovered the color bass scene and many of the artists associated with Rushdown, including Chime, Ace Aura, and KERO, alongside Au5 and other producers exploring similar musical ideas.",
          "También descubrí la escena del color bass y a muchos de los artistas relacionados con Rushdown, entre ellos Chime, Ace Aura y KERO, además de Au5 y otros productores cercanos a estas sensibilidades."
        ],
        [
          "What interested me was how these artists could combine intricate sounds with melody and harmony. I could hear a connection between the intensity of the dubstep I loved as a child and a more elaborate kind of musicality.",
          "Me interesaba mucho la manera en que estos artistas combinaban sonidos complejos con melodías y armonías. Encontraba en esa música una conexión entre la intensidad del dubstep que había escuchado de pequeño y una musicalidad cada vez más elaborada."
        ],
        [
          "I don't remember these discoveries as an orderly sequence of artists. It was more like a period of constant exploration. I would move from one producer to another, encounter new techniques, and hear how each artist developed a sound of their own.",
          "No recuerdo estos descubrimientos como una sucesión ordenada de artistas, sino como una época de exploración constante. Pasaba de un productor a otro, encontraba nuevas técnicas y escuchaba cómo cada uno desarrollaba su propia identidad sonora."
        ],
        [
          "All of this shaped my appreciation for digital textures, distortion, modulation, and sound design. That connection to electronic music never disappeared, even as my other musical interests became increasingly important.",
          "Todo aquello fue ampliando mi gusto por las texturas digitales, la distorsión, las modulaciones y el diseño sonoro. Esa relación con la electrónica nunca se interrumpió, incluso cuando mis otros intereses musicales empezaron a ocupar cada vez más espacio."
        ]
      ]
    },
    {
      "title": [
        "University and a more intimate way of listening",
        "La universidad y una forma más íntima de escuchar"
      ],
      "paragraphs": [
        [
          "When I started university, my relationship with alternative music became much deeper. I began listening to Joji a lot and connected particularly with his melancholic melodies, vocals, and the atmospheres surrounding them.",
          "Cuando comencé la universidad, mi relación con la música alternativa se hizo más profunda. Empecé a escuchar mucho a Joji y conecté especialmente con sus melodías melancólicas, sus voces y las atmósferas que construía."
        ],
        [
          "I liked how his songs could communicate sadness or nostalgia without needing elaborate arrangements. I began finding more value in space, quieter sounds, and the emotions that a simple melody could carry.",
          "Me gustaba cómo sus canciones podían transmitir tristeza o nostalgia sin necesitar grandes arreglos. Empecé a encontrar mucho valor en los espacios, en los sonidos más suaves y en las emociones que podía provocar una melodía sencilla."
        ],
        [
          "Fujii Kaze, meanwhile, introduced me to Japanese music and a sound influenced by R&B, soul, and jazz. His singing, piano playing, and approach to harmony felt natural and expressive to me. Through his music, I began paying closer attention to a kind of musicality I hadn't explored as much before.",
          "Por otra parte, Fujii Kaze me acercó a la música japonesa y a una sonoridad vinculada con el R&B, el soul y el jazz. Su manera de cantar, tocar el piano y construir armonías me resultaba muy natural y expresiva. A través de él empecé a prestar mayor atención a una musicalidad que hasta entonces no había explorado tanto."
        ],
        [
          "I had also been listening to Tyler, the Creator before discovering Jacob Collier. Tyler was an important influence because of how he works with chords, synthesizers, vocals, and arrangements, and how all those elements contribute to such a recognizable artistic identity.",
          "También había estado escuchando a Tyler, the Creator antes de descubrir a Jacob Collier. Tyler fue una influencia importante por su manera de trabajar con acordes, sintetizadores, voces y arreglos, y por cómo conseguía que todos esos elementos formaran parte de una identidad artística muy reconocible."
        ],
        [
          "I spent quite a long time immersed in these sounds, enjoying indie music, R&B, and more introspective songwriting. Gradually, I developed a different sensitivity to harmony and to the emotions a composition could express.",
          "Durante bastante tiempo estuve inmerso en estas sonoridades, disfrutando del indie, el R&B y la música más introspectiva. Poco a poco fui desarrollando una sensibilidad distinta hacia la armonía y hacia las emociones que podía expresar una composición."
        ]
      ]
    },
    {
      "title": [
        "Discovering Jacob Collier",
        "El descubrimiento de Jacob Collier"
      ],
      "paragraphs": [
        [
          "One of the most important moments in my musical journey happened when I came across a clip on Instagram related to Jacob Collier's arrangement of Moon River.",
          "Uno de los momentos más importantes de mi recorrido ocurrió cuando vi en Instagram un fragmento relacionado con la interpretación de Moon River de Jacob Collier."
        ],
        [
          "The video made me curious, so I went to YouTube to listen to the full recording. I remember connecting immediately with the harmonies, the overlapping voices, and the way the entire composition unfolded. There was so much happening within the arrangement that I wanted to listen again and understand more of what I was hearing.",
          "El video despertó mi curiosidad y fui a YouTube para escuchar la canción completa. Recuerdo haber conectado inmediatamente con las armonías, la superposición de voces y la manera en que toda la composición iba desarrollándose. Había tantas cosas ocurriendo dentro de aquel arreglo que quería volver a escucharlo para entender mejor lo que estaba pasando."
        ],
        [
          "It felt different from anything I had experienced up to that point. I was interested in the beauty of the music, but also in how it had been constructed and all the musical decisions that seemed to exist behind it.",
          "Fue una experiencia diferente de las que había tenido hasta entonces. Me interesaba la belleza de la música, pero también cómo estaba construida y todas las decisiones musicales que parecían existir detrás de ella."
        ],
        [
          "From that moment on, I began exploring Jacob Collier's work much more deeply. I listened to his songs, arrangements, and different projects, and found so many things that interested me: unusual harmonies, improvisation, combinations of genres, and a remarkably open approach to composition.",
          "A partir de ese momento comencé a explorar la obra de Jacob Collier con mucha más profundidad. Escuché sus canciones, arreglos y diferentes proyectos, y terminé encontrando en su música una enorme cantidad de cosas que me interesaban: armonías poco habituales, improvisación, combinaciones de géneros y una manera muy libre de entender la composición."
        ],
        [
          "He is now my favorite artist.",
          "Actualmente es mi artista favorito."
        ],
        [
          "What I value most about Jacob is that his music made me want to understand harmony more deeply and explore possibilities I hadn't considered before. His work changed the direction of my musical curiosity and led me to other artists who have since become important references in my life.",
          "Lo que más valoro de Jacob es que su música me hizo querer comprender mejor la armonía y explorar posibilidades que antes no había considerado. Su trabajo cambió mi curiosidad musical y me llevó a descubrir a otros artistas que hoy forman parte importante de mis referencias."
        ]
      ]
    },
    {
      "title": [
        "Keith Jarrett and discovering the piano",
        "Keith Jarrett y mi acercamiento al piano"
      ],
      "paragraphs": [
        [
          "While watching Jacob Collier's interviews, I learned about his admiration for Keith Jarrett, whom he mentioned as one of his major musical influences.",
          "Escuchando entrevistas de Jacob Collier descubrí su admiración por Keith Jarrett, a quien mencionaba entre sus grandes influencias musicales."
        ],
        [
          "I decided to look up Jarrett's performances and started listening to his piano recordings. I was drawn to the way he improvised, developed ideas, and allowed a performance to unfold naturally, without always following a rigid structure.",
          "Decidí buscar sus interpretaciones y empecé a escuchar sus obras de piano. Me llamó mucho la atención su forma de improvisar, desarrollar ideas y hacer que una interpretación pareciera evolucionar de manera natural, sin necesidad de seguir una estructura rígida."
        ],
        [
          "I had listened to piano music before, but Jarrett made me interested in the instrument in a different way. His music was what eventually motivated me to start playing piano myself.",
          "Hasta entonces había escuchado música de piano, pero con Jarrett empecé a interesarme de otra manera por el instrumento. Su música fue la que finalmente me motivó a comenzar a tocar piano."
        ],
        [
          "From there, I became more involved with jazz and discovered other pianists, especially Bill Evans. His approach to harmony, voicings, and melody helped me appreciate details I might previously have overlooked.",
          "A partir de ahí fui acercándome más al jazz y descubrí a otros pianistas, especialmente a Bill Evans. Su manera de trabajar con la armonía, los acordes y las melodías me ayudó a apreciar detalles que antes podían pasarme desapercibidos."
        ],
        [
          "I started listening more closely to the spaces between notes, the tensions within chords, and the small interpretive decisions that can completely change the character of a piece.",
          "Comencé a escuchar con mayor atención los espacios entre las notas, las tensiones de los acordes y las pequeñas decisiones interpretativas que pueden cambiar por completo el carácter de una pieza."
        ],
        [
          "Piano opened up another dimension of music for me. It was no longer just about listening to productions I enjoyed, but also about approaching music through performance and developing a deeper curiosity about its harmonic language.",
          "El piano abrió otra dimensión en mi relación con la música. Ya no se trataba solamente de escuchar producciones que me gustaban, sino también de acercarme a la música desde la interpretación y desde una curiosidad más profunda por su lenguaje armónico."
        ]
      ]
    },
    {
      "title": [
        "Moving toward ambient and experimental music",
        "Hacia el ambient y la música experimental"
      ],
      "paragraphs": [
        [
          "Over time, I became increasingly interested in more experimental indie music and sounds where texture and atmosphere played a central role.",
          "Con el tiempo fui acercándome a la música indie más experimental y a sonoridades donde la textura y la atmósfera tenían un papel cada vez más importante."
        ],
        [
          "One of the most meaningful discoveries during this period was Oneohtrix Point Never, particularly through Tranquilizer. His music connected me with a different kind of electronic sound from what I had spent so many years listening to: one where sounds could become abstract, fragmented, unfamiliar, or even difficult to identify.",
          "Uno de los descubrimientos más significativos de esta etapa fue Oneohtrix Point Never, especialmente a través de Tranquilizer. Su música me hizo conectar con una electrónica diferente de la que había escuchado durante tantos años: una en la que los sonidos podían resultar abstractos, fragmentados, extraños o incluso difíciles de identificar."
        ],
        [
          "I was interested in how those textures could create entire environments and evoke feelings without necessarily relying on traditional melodies or steady rhythmic structures.",
          "Me interesaba cómo esas texturas podían construir ambientes completos y producir sensaciones sin depender necesariamente de una melodía tradicional o una estructura rítmica estable."
        ],
        [
          "I also discovered Boards of Canada and connected with their aged-sounding recordings, hazy melodies, and the sense of nostalgia that runs through much of their music. I became interested in how imperfection, repetition, and audio manipulation could work as expressive tools.",
          "También descubrí a Boards of Canada y conecté con sus grabaciones de apariencia envejecida, sus melodías difusas y esa sensación de nostalgia que atraviesa buena parte de su música. Me empezó a interesar cómo la imperfección, la repetición y la manipulación del sonido podían convertirse en recursos expresivos."
        ],
        [
          "Along this path, I also came across the vaporwave explorations of cubalibre.exe, a Cuban artist whose music introduced me to another way of approaching recordings, digital nostalgia, and electronic textures. It was especially interesting to encounter this kind of experimentation within a scene connected to Cuba.",
          "En este recorrido también encontré las exploraciones de vaporwave de cubalibre.exe, un artista cubano cuya música me permitió descubrir otra forma de acercarme a las grabaciones, la nostalgia digital y las texturas electrónicas. Me resultó especialmente interesante encontrar estas búsquedas dentro de una escena vinculada a Cuba."
        ],
        [
          "More recently, I've been listening to Ryuichi Sakamoto. His music has brought me closer to a more contemplative sensibility, where piano, silence, resonance, and space play an important role.",
          "Más recientemente he estado escuchando a Ryuichi Sakamoto. Su música me ha acercado a una sensibilidad más contemplativa, donde el piano, el silencio, las resonancias y los espacios tienen una presencia muy importante."
        ],
        [
          "These discoveries expanded my interest in music that doesn't need to be constantly intense or filled with elements. Sometimes a texture, an isolated sound, or an atmosphere can carry much of what I want to hear.",
          "Estos descubrimientos ampliaron mi interés por una música que no necesita ser constantemente intensa o estar llena de elementos. A veces, una textura, un sonido aislado o una atmósfera pueden sostener gran parte de lo que quiero escuchar."
        ]
      ]
    },
    {
      "title": [
        "What I'm making now",
        "Lo que hago actualmente"
      ],
      "paragraphs": [
        [
          "Today, I still feel strongly connected to the electronic music I discovered as a child. Dubstep, riddim, and sound design remain important parts of how I produce music, although my interests have gradually moved toward more experimental forms.",
          "Hoy sigo teniendo una relación muy fuerte con la música electrónica que descubrí de pequeño. El dubstep, el riddim y el diseño sonoro siguen siendo una parte importante de mi manera de producir, aunque mis intereses se han ido desplazando hacia formas más experimentales."
        ],
        [
          "I currently work with resynthesis, granular resampling, distorted additive synthesis, and different approaches to audio manipulation. I'm interested in building complex textures, creating unusual movement within sounds, and working with timbres that can change character throughout a composition.",
          "Actualmente trabajo con resíntesis, resampling granular, síntesis aditiva distorsionada y diferentes procesos de manipulación de audio. Me interesa construir texturas complejas, con movimientos poco convencionales y sonidos que puedan cambiar de carácter a lo largo de una composición."
        ],
        [
          "I'm particularly drawn to warped, hazy, and bright sounds, timbres that are difficult to identify, and unpredictable structures. I enjoy it when a piece can move between dense, intricate passages and more open moments without feeling restricted by conventional electronic dance music arrangements.",
          "Me atraen especialmente las sonoridades torcidas, difusas y brillantes, los timbres difíciles de identificar y las estructuras impredecibles. Disfruto cuando una pieza puede desplazarse entre momentos de mucha densidad y otros más abiertos, sin sentirse obligada a seguir las formas habituales de la música electrónica de baile."
        ],
        [
          "Although my work comes from an electronic foundation, it also draws on everything I've discovered along the way: Joji's melancholy, the harmonies I found in Jacob Collier's music, my introduction to piano through Keith Jarrett, and the textures and atmospheres that led me toward Oneohtrix Point Never, Boards of Canada, and Ryuichi Sakamoto.",
          "Aunque mi trabajo parte de esa base electrónica, también se alimenta de todo lo que he ido descubriendo: la melancolía de Joji, las armonías que encontré en Jacob Collier, mi acercamiento al piano a través de Keith Jarrett, y las texturas y atmósferas que me llevaron hacia Oneohtrix Point Never, Boards of Canada y Ryuichi Sakamoto."
        ],
        [
          "I'm not trying to combine all these influences literally or make music that necessarily sounds like any of these artists. They are references that have changed the way I listen, and in one way or another, they inform the decisions I make when producing.",
          "No intento reunir todas estas influencias de manera literal ni hacer música que suene necesariamente como la de estos artistas. Son referencias que han cambiado mi manera de escuchar y que, de una forma u otra, aparecen en las decisiones que tomo cuando produzco."
        ],
        [
          "In my upcoming work, I want to continue exploring this direction, moving closer to soundtrack composition and soundscapes. I'm interested in working with space, narrative, and the feeling of listening to an environment that changes and evolves.",
          "En mis próximos trabajos quiero continuar explorando esta dirección, acercándome más a la composición de bandas sonoras y paisajes sonoros. Me interesa trabajar con el espacio, la narrativa y la sensación de estar escuchando un entorno que cambia y evoluciona."
        ],
        [
          "I still enjoy the aggressive, intricate sounds that fascinated me as a child, but I'm now equally interested in what happens when I combine them with more fragile atmospheres, harmony, silence, and less predictable structures.",
          "Sigo disfrutando de los sonidos agresivos y complejos que me fascinaron cuando era niño, pero ahora también me interesa qué sucede cuando los combino con ambientes más frágiles, armonías, silencios y estructuras menos previsibles."
        ],
        [
          "That coexistence between the music I've always loved and everything I've discovered since is, to a large extent, what defines the way I make music today.",
          "Esa convivencia entre lo que siempre he escuchado y todo lo que he descubierto después es, en buena medida, lo que define mi manera actual de hacer música."
        ]
      ]
    }
  ]
} as const;

const journeyTranslations = [
  musicJourneyCopy.title,
  musicJourneyCopy.subtitle,
  ...musicJourneyCopy.intro,
  ...musicJourneyCopy.chapters.flatMap(chapter => [chapter.title, ...chapter.paragraphs]),
  ["03 / influences","03 / influencias"],
  ["Electronic root / continuous","Raíz electrónica / continua"],
  ["Musical expansion / discoveries","Expansión musical / descubrimientos"],
  ["Electronic root","Raíz electrónica"],
  ["Musical expansion","Expansión musical"],
  ["Shared beginnings","Los primeros descubrimientos"],
  ["Adolescence / parallel paths","Adolescencia / caminos paralelos"],
  ["Pandemic, university and after / overlapping discoveries","Pandemia, universidad y después / descubrimientos en paralelo"],
  ["A turning point / the electronic thread continues","Un punto de inflexión / la electrónica continúa"],
  ["From listening to playing","De escuchar a tocar"],
  ["Recent discoveries / the paths draw closer","Descubrimientos recientes / los caminos se acercan"],
  ["Both paths / now","Ambos caminos / presente"],
  ["Listen to Moon River ↗","Escuchar Moon River ↗"],
  ["Artist photography credits ↗","Créditos de las fotografías ↗"],
];

const messages: Record<string, Translations> = {
  "Page shortcuts": ["Atajos de página", "Raccourcis de page", "Seitennavigation", "ページ内ナビゲーション"],
  "Back to top": ["Volver al inicio", "Retour en haut", "Nach oben", "ページの先頭へ"],
  "Go to page end": ["Ir al final", "Aller en bas", "Zum Seitenende", "ページの末尾へ"],
  ...Object.fromEntries(journeyTranslations.map(([en, es]) => [en, [es, en, en, en] satisfies Translations])),
  "Contact me": ["Contáctame", "Me contacter", "Kontakt aufnehmen", "お問い合わせ"],
  "Language": ["Idioma", "Langue", "Sprache", "言語"],
  "loading": ["cargando", "chargement", "wird geladen", "読み込み中"],
  "loading cosmiclatte": ["cargando cosmiclatte", "chargement de cosmiclatte", "cosmiclatte wird geladen", "cosmiclatteを読み込み中"],
  "waking up": ["iniciando", "démarrage", "wird gestartet", "起動中"],
  "reading the page": ["leyendo la página", "lecture de la page", "Seite wird gelesen", "ページを読み込み中"],
  "loading fonts": ["cargando fuentes", "chargement des polices", "Schriften werden geladen", "フォントを読み込み中"],
  "starting the parts that move": ["iniciando componentes interactivos", "démarrage des composants interactifs", "interaktive Komponenten starten", "インタラクティブな部分を起動中"],
  "finishing the pictures": ["terminando las imágenes", "finalisation des images", "Bilder werden fertiggestellt", "画像の準備中"],
  "Dark mode": ["Modo oscuro", "Mode sombre", "Dunkelmodus", "ダークモード"],
  "Light mode": ["Modo claro", "Mode clair", "Hellmodus", "ライトモード"],
  "view code ↗": ["ver código ↗", "voir le code ↗", "Code ansehen ↗", "コードを見る ↗"],
  "show controls": ["mostrar controles", "afficher les réglages", "Einstellungen anzeigen", "設定を表示"],
  "show player": ["mostrar reproductor", "afficher le lecteur", "Player anzeigen", "プレーヤーを表示"],
  "hide player": ["ocultar reproductor", "masquer le lecteur", "Player ausblenden", "プレーヤーを隠す"],
  "· {count} tracks": ["· {count} temas", "· {count} morceaux", "· {count} Tracks", "· {count}曲"],
  "Depth {depth} produces {count} cells. A cut ratio of 0.50 forms a regular grid.": ["La profundidad {depth} produce {count} celdas. Una proporción de corte de 0.50 forma una cuadrícula regular.", "La profondeur {depth} produit {count} cellules. Un rapport de coupe de 0.50 forme une grille régulière.", "Tiefe {depth} ergibt {count} Zellen. Ein Schnittverhältnis von 0.50 bildet ein regelmäßiges Raster.", "深さ{depth}で{count}セルを生成します。分割比率0.50で規則的な格子になります。"],
  "cells · depth": ["celdas · profundidad", "cellules · profondeur", "Zellen · Tiefe", "セル · 深さ"],
  "· every cut splits in two": ["· cada corte divide en dos", "· chaque coupe divise en deux", "· jeder Schnitt teilt in zwei", "· 各分割で2つに分けます"],
  "cells ·": ["celdas ·", "cellules ·", "Zellen ·", "セル ·"],
  "fps ·": ["fps ·", "ips ·", "fps ·", "fps ·"],
  "mixes ·": ["mezclas ·", "mélanges ·", "Mischungen ·", "混合 ·"],
  "traces ·": ["trazas ·", "traces ·", "Spuren ·", "軌跡 ·"],
  "Depth": ["Profundidad", "Profondeur", "Tiefe", "深さ"],
  "produces": ["produce", "produit", "ergibt", "で生成するのは"],
  "cells. A cut ratio of 0.50 forms a regular grid.": ["celdas. Una proporción de corte de 0.50 forma una cuadrícula regular.", "cellules. Un rapport de coupe de 0.50 forme une grille régulière.", "Zellen. Ein Schnittverhältnis von 0.50 bildet ein regelmäßiges Raster.", "セルです。分割比率0.50で規則的な格子になります。"],
  "pigment board. move the pointer to stir the flow, scroll to zoom, shift and drag to pan.": ["Lienzo de pigmentos. Mueve el puntero para agitar, desplaza para ampliar y arrastra con Mayús para mover la vista.", "Toile de pigments. Déplacez le pointeur pour remuer, faites défiler pour zoomer, Maj et glisser pour déplacer la vue.", "Pigmentfläche. Zeiger bewegen zum Rühren, scrollen zum Zoomen, Umschalt und Ziehen zum Verschieben.", "顔料キャンバス。ポインターで流れをかき混ぜ、スクロールでズーム、Shiftを押しながらドラッグで移動します。"],
  "Mon": ["Lun", "Lun", "Mo", "月"],
  "Wed": ["Mié", "Mer", "Mi", "水"],
  "Fri": ["Vie", "Ven", "Fr", "金"],
  "Jan": ["Ene", "Janv", "Jan", "1月"],
  "Feb": ["Feb", "Févr", "Feb", "2月"],
  "Mar": ["Mar", "Mars", "Mär", "3月"],
  "Apr": ["Abr", "Avr", "Apr", "4月"],
  "May": ["May", "Mai", "Mai", "5月"],
  "Jun": ["Jun", "Juin", "Jun", "6月"],
  "Jul": ["Jul", "Juil", "Jul", "7月"],
  "Aug": ["Ago", "Août", "Aug", "8月"],
  "Sep": ["Sep", "Sept", "Sep", "9月"],
  "Oct": ["Oct", "Oct", "Okt", "10月"],
  "Nov": ["Nov", "Nov", "Nov", "11月"],
  "Dec": ["Dic", "Déc", "Dez", "12月"],
  "rate {count} of 5": ["valorar {count} de 5", "noter {count} sur 5", "{count} von 5 bewerten", "5段階中{count}と評価"],
  "Player: {platform}": ["Reproductor: {platform}", "Lecteur : {platform}", "Player: {platform}", "プレーヤー：{platform}"],
  "Unavailable on {platform}": ["No disponible en {platform}", "Indisponible sur {platform}", "Auf {platform} nicht verfügbar", "{platform}では利用できません"],
  "open {title} on {platform}": ["abrir {title} en {platform}", "ouvrir {title} sur {platform}", "{title} auf {platform} öffnen", "{platform}で{title}を開く"],
  "{title} player": ["Reproductor de {title}", "Lecteur de {title}", "Player für {title}", "{title}のプレーヤー"],
  "0.50 is an exact grid · {floor} is the minimum at depth {depth}": ["0.50 es una cuadrícula exacta · {floor} es el mínimo a profundidad {depth}", "0.50 est une grille exacte · {floor} est le minimum à la profondeur {depth}", "0.50 ist ein exaktes Raster · {floor} ist das Minimum bei Tiefe {depth}", "0.50で正確な格子 · 深さ{depth}での最小値は{floor}"],
  "Main navigation": ["Navegación principal", "Navigation principale", "Hauptnavigation", "メインナビゲーション"],
  "home": ["inicio", "accueil", "startseite", "ホーム"],
  "coding": ["código", "code", "Code", "開発"],
  "music": ["música", "musique", "Musik", "音楽"],
  "experiments": ["experimentos", "expériences", "Experimente", "実験"],
  "portfolio": ["portafolio", "portfolio", "Portfolio", "ポートフォリオ"],
  "i": ["yo", "je", "ich", "私は"],
  "code": ["programo", "code", "programmiere", "コードを書き"],
  "& shrink": ["y moldeo", "et façonne", "und forme", "そして形づくる"],
  "soundwaves": ["ondas sonoras", "les ondes sonores", "Schallwellen", "音の波を"],
  "01 / who am i (。_。)": ["01 / quién soy (。_。)", "01 / qui suis-je (。_。)", "01 / wer bin ich (。_。)", "01 / 自己紹介 (。_。)"],
  "A little about myself.": ["Un poco sobre mí.", "Un peu de moi.", "Ein wenig über mich.", "私について。"],
  "I'm a software engineer based in Santa Clara, Cuba. I turn requirements into software people can use. I design modular applications, build fullstack environments, and write about improvements for UI/UX, always worried about the client.": ["Soy ingeniero de software en Santa Clara, Cuba. Convierto requisitos en software que la gente puede usar. Diseño aplicaciones modulares, construyo entornos fullstack y escribo sobre mejoras de UI/UX, siempre pensando en el cliente.", "Je suis ingénieur logiciel à Santa Clara, à Cuba. Je transforme les besoins en logiciels utilisables. Je conçois des applications modulaires, construis des environnements fullstack et écris sur les améliorations UI/UX, toujours à l'écoute du client.", "Ich bin Softwareentwickler in Santa Clara, Kuba. Ich setze Anforderungen in nutzbare Software um. Ich entwerfe modulare Anwendungen, baue Fullstack-Umgebungen und schreibe über UI/UX-Verbesserungen, immer mit Blick auf die Kunden.", "キューバのサンタクララを拠点とするソフトウェアエンジニアです。要件を使いやすいソフトウェアに変え、モジュール型アプリケーションの設計やフルスタック環境の構築を行っています。常に利用者を考え、UI/UXの改善についても発信しています。"],
  "Education": ["Formación", "Formation", "Ausbildung", "学歴"],
  "Research": ["Investigación", "Recherche", "Forschung", "研究"],
  "Languages": ["Idiomas", "Langues", "Sprachen", "使用言語"],
  "Spanish (native) / English (C1+)": ["Español (nativo) / Inglés (C1+)", "Espagnol (langue maternelle) / Anglais (C1+)", "Spanisch (Muttersprache) / Englisch (C1+)", "スペイン語（母語）/ 英語（C1+）"],
  "Santa Clara, Villa Clara, Cuba / (+53)58778025": ["Santa Clara, Villa Clara, Cuba / (+53)58778025", "Santa Clara, Villa Clara, Cuba / (+53)58778025", "Santa Clara, Villa Clara, Kuba / (+53)58778025", "キューバ、ビジャ・クララ州サンタクララ / (+53)58778025"],
  "React, Next.js, Astro, TailwindCSS, responsive UI, API integration": ["React, Next.js, Astro, TailwindCSS, interfaces adaptables e integración de APIs", "React, Next.js, Astro, TailwindCSS, interfaces adaptatives et intégration d'API", "React, Next.js, Astro, TailwindCSS, responsive Oberflächen und API-Integration", "React、Next.js、Astro、TailwindCSS、レスポンシブUI、API連携"],
  "Spring Boot, Spring Security, Spring Data JPA, JWT, FastAPI, REST APIs, DTO design, service and repository patterns": ["Spring Boot, Spring Security, Spring Data JPA, JWT, FastAPI, APIs REST, diseño de DTO y patrones de servicios y repositorios", "Spring Boot, Spring Security, Spring Data JPA, JWT, FastAPI, API REST, conception de DTO et modèles service et dépôt", "Spring Boot, Spring Security, Spring Data JPA, JWT, FastAPI, REST-APIs, DTO-Entwurf sowie Service- und Repository-Muster", "Spring Boot、Spring Security、Spring Data JPA、JWT、FastAPI、REST API、DTO設計、サービス・リポジトリパターン"],
  "Java, Python, JS/TS, Kotlin, Dart (Flutter), PHP, Rust, Lua, C#, C": ["Java, Python, JS/TS, Kotlin, Dart (Flutter), PHP, Rust, Lua, C# y C", "Java, Python, JS/TS, Kotlin, Dart (Flutter), PHP, Rust, Lua, C# et C", "Java, Python, JS/TS, Kotlin, Dart (Flutter), PHP, Rust, Lua, C# und C", "Java、Python、JS/TS、Kotlin、Dart（Flutter）、PHP、Rust、Lua、C#、C"],
  "Claude Code, Codex, OpenCode, Gemini, Cursor, IntelliJ IDEA, VSCode, Zed, Neovim": ["Claude Code, Codex, OpenCode, Gemini, Cursor, IntelliJ IDEA, VSCode, Zed y Neovim", "Claude Code, Codex, OpenCode, Gemini, Cursor, IntelliJ IDEA, VSCode, Zed et Neovim", "Claude Code, Codex, OpenCode, Gemini, Cursor, IntelliJ IDEA, VSCode, Zed und Neovim", "Claude Code、Codex、OpenCode、Gemini、Cursor、IntelliJ IDEA、VSCode、Zed、Neovim"],
  "PostgreSQL, SQL, SQLite, Flyway, relational modeling, layered and modular architecture, microservices, multi-tenancy, RBAC, Git, GitHub Actions, Docker, Maven, Gradle": ["PostgreSQL, SQL, SQLite, Flyway, modelado relacional, arquitectura modular y en capas, microservicios, multitenencia, RBAC, Git, GitHub Actions, Docker, Maven y Gradle", "PostgreSQL, SQL, SQLite, Flyway, modélisation relationnelle, architecture en couches et modulaire, microservices, multi-tenant, RBAC, Git, GitHub Actions, Docker, Maven et Gradle", "PostgreSQL, SQL, SQLite, Flyway, relationale Modellierung, geschichtete und modulare Architektur, Microservices, Mandantenfähigkeit, RBAC, Git, GitHub Actions, Docker, Maven und Gradle", "PostgreSQL、SQL、SQLite、Flyway、リレーショナルモデリング、レイヤード・モジュラーアーキテクチャ、マイクロサービス、マルチテナント、RBAC、Git、GitHub Actions、Docker、Maven、Gradle"],
  "I began electrical engineering in 2022 and moved to software engineering in 2023 at Universidad Central “Marta Abreu” de Las Villas. I graduated in 2026 with outstanding results.": ["Comencé ingeniería eléctrica en 2022 y pasé a ingeniería de software en 2023 en la Universidad Central “Marta Abreu” de Las Villas. Me gradué en 2026 con resultados destacados.", "J'ai commencé le génie électrique en 2022, puis le génie logiciel en 2023 à l'Universidad Central “Marta Abreu” de Las Villas. J'ai obtenu mon diplôme en 2026 avec d'excellents résultats.", "2022 begann ich Elektrotechnik zu studieren und wechselte 2023 an der Universidad Central “Marta Abreu” de Las Villas zur Softwareentwicklung. 2026 schloss ich mit hervorragenden Ergebnissen ab.", "2022年に電気工学の勉強を始め、2023年にラス・ビジャス中央大学「マルタ・アブレウ」でソフトウェア工学に転向しました。2026年に優秀な成績で卒業しました。"],
  "I presented an intensive care patient simulation engine at scientific events in Villa Clara and built the platform that brings it together with other clinical tools for the Arnaldo Milián Castro Hospital. This work received a Research for Simulation Software award in 2025.": ["Presenté un motor de simulación de pacientes de cuidados intensivos en eventos científicos de Villa Clara y desarrollé la plataforma que lo integra con otras herramientas clínicas para el Hospital Arnaldo Milián Castro. Este trabajo recibió un premio de investigación en software de simulación en 2025.", "J'ai présenté un moteur de simulation de patients en soins intensifs lors d'événements scientifiques à Villa Clara et créé la plateforme qui l'intègre à d'autres outils cliniques pour l'hôpital Arnaldo Milián Castro. Ce travail a reçu un prix de recherche en logiciels de simulation en 2025.", "Ich stellte einen Simulationsmotor für Intensivpatienten auf wissenschaftlichen Veranstaltungen in Villa Clara vor und entwickelte die Plattform, die ihn mit weiteren klinischen Werkzeugen für das Krankenhaus Arnaldo Milián Castro verbindet. Diese Arbeit erhielt 2025 einen Forschungspreis für Simulationssoftware.", "ビジャ・クララの学会で集中治療患者のシミュレーションエンジンを発表し、アルナルド・ミリアン・カストロ病院向けに他の臨床ツールと統合するプラットフォームを構築しました。この研究は2025年にシミュレーションソフトウェアの研究賞を受賞しました。"],
  "02 / outside the editor": ["02 / fuera del editor", "02 / hors de l'éditeur", "02 / abseits des Editors", "02 / エディターの外で"],
  "What keeps me awake.": ["Lo que me desvela.", "Ce qui me tient éveillé.", "Was mich wach hält.", "夢中になっていること。"],
  "Listening": ["Escuchando", "À l'écoute", "Zuhören", "聴くこと"],
  "Music, from every angle.": ["Música, desde todos los ángulos.", "La musique sous tous les angles.", "Musik aus jedem Blickwinkel.", "あらゆる角度から音楽を。"],
  "Experimental music, piano, jazz. I make music too, and I love sound design and the physics behind it.": ["Música experimental, piano, jazz. También hago música y me encanta el diseño sonoro y la física que hay detrás.", "Musique expérimentale, piano, jazz. Je compose aussi et j'aime le design sonore et la physique du son.", "Experimentelle Musik, Klavier, Jazz. Ich mache auch selbst Musik und liebe Sounddesign und die Physik dahinter.", "実験音楽、ピアノ、ジャズ。自分でも音楽を作り、サウンドデザインや音の物理学に興味があります。"],
  "hear my music": ["escucha mi música", "écouter ma musique", "meine Musik hören", "音楽を聴く"],
  "Free time": ["Tiempo libre", "Temps libre", "Freizeit", "余暇"],
  "When I'm not working.": ["Cuando no estoy trabajando.", "Quand je ne travaille pas.", "Wenn ich nicht arbeite.", "仕事をしていないとき。"],
  "I enjoy playing modded minecraft, factorio, balatro, elden ring and online games like Delta Force, Battlefield VI and other dumb games with my homies. I also watch quite a lot of youtube.": ["Me gusta jugar Minecraft con mods, Factorio, Balatro, Elden Ring y juegos online como Delta Force, Battlefield VI y otras tonterías con mis amigos. También veo bastante YouTube.", "J'aime jouer à Minecraft moddé, Factorio, Balatro, Elden Ring et à des jeux en ligne comme Delta Force, Battlefield VI et d'autres bêtises entre amis. Je regarde aussi pas mal de YouTube.", "Ich spiele gern Minecraft mit Mods, Factorio, Balatro, Elden Ring und Onlinespiele wie Delta Force, Battlefield VI und anderen Quatsch mit meinen Freunden. Außerdem schaue ich viel YouTube.", "Mod入りのMinecraft、Factorio、Balatro、Elden Ringのほか、Delta ForceやBattlefield VIなどのオンラインゲームを友人と楽しんでいます。YouTubeもよく見ます。"],
  "These are some of the people I keep coming back to:": ["Estos son algunos de los creadores a los que siempre vuelvo:", "Voici quelques créateurs que je regarde régulièrement :", "Diese Kanäle schaue ich immer wieder:", "よく見ているクリエイターたちです："],
  "Creators I keep coming back to:": ["Creadores a los que siempre vuelvo:", "Les créateurs que je retrouve toujours :", "Kanäle, zu denen ich immer wieder zurückkehre:", "何度も見に戻ってくるクリエイターたち："],
  "my favorite channel for math animations and machine learning, with wonderful courses": ["mi canal favorito de animaciones matemáticas y machine learning, con cursos maravillosos", "ma chaîne préférée d'animations mathématiques et de machine learning, avec de magnifiques cours", "mein Lieblingskanal für Mathematik-Animationen und Machine Learning, mit wundervollen Kursen", "数学のアニメーションと機械学習でお好きなチャンネル。素晴らしいコースもあります"],
  "my trusted channel for learning science with reliable sources": ["mi canal de confianza para aprender ciencia con fuentes fiables", "ma chaîne de confiance pour apprendre la science avec des sources fiables", "mein Vertrauenskanal für Wissenschaft mit verlässlichen Quellen", "信頼できる情報源で科学を学ぶための信頼できるチャンネル"],
  "my channel for tech news": ["mi canal de noticias tecnológicas", "ma chaîne pour l'actualité tech", "mein Kanal für IT-Nachrichten", "テックニュースのチャンネル"],
  "my entertainment channel for lunch and dinner": ["mi canal de entretenimiento para el almuerzo y la cena", "ma chaîne de divertissement pour le déjeuner et le dîner", "mein Unterhaltungskanal für Mittag- und Abendessen", "昼食や夕食のときの娯楽チャンネル"],
  "03 / contact": ["03 / contacto", "03 / contact", "03 / Kontakt", "03 / お問い合わせ"],
  "Have something in mind?": ["¿Tienes algo en mente?", "Une idée en tête ?", "Hast du etwas im Sinn?", "何かアイデアはありますか？"],
  "send me an email ↗": ["envíame un correo ↗", "m'envoyer un e-mail ↗", "schreib mir eine E-Mail ↗", "メールを送る ↗"],
  "01 / intro": ["01 / introducción", "01 / introduction", "01 / Einführung", "01 / はじめに"],
  "Work in code.": ["Mi trabajo en código.", "Mon travail en code.", "Meine Arbeit in Code.", "コードでつくる仕事。"],
  "my main focus is on backend systems, toolings, and experimental & math software. The projects below come from my pinned GitHub repositories and update with my profile.": ["Me centro en sistemas backend, herramientas y software experimental y matemático. Los proyectos de abajo proceden de mis repositorios fijados en GitHub y se actualizan con mi perfil.", "Je me concentre sur les systèmes backend, les outils et les logiciels expérimentaux et mathématiques. Les projets ci-dessous proviennent de mes dépôts épinglés sur GitHub et suivent mon profil.", "Mein Schwerpunkt liegt auf Backend-Systemen, Werkzeugen sowie experimenteller und mathematischer Software. Die folgenden Projekte stammen aus meinen angehefteten GitHub-Repositories und aktualisieren sich mit meinem Profil.", "バックエンドシステム、開発ツール、実験的・数学的ソフトウェアを中心に開発しています。以下のプロジェクトはGitHubのピン留めリポジトリから取得し、プロフィールと連動して更新されます。"],
  "open GitHub ↗": ["abrir GitHub ↗", "ouvrir GitHub ↗", "GitHub öffnen ↗", "GitHubを開く ↗"],
  "Experience": ["Experiencia", "Expérience", "Erfahrung", "経験"],
  "01 / musical journey": ["01 / recorrido musical", "01 / parcours musical", "01 / musikalischer Weg", "01 / 音楽の歩み"],
  "One foundation.An expanding ear.": ["Una base. Un oído en expansión.", "Une base. Une écoute qui s'élargit.", "Ein Fundament. Ein weiter Hörhorizont.", "ひとつの原点、広がる音楽の世界。"],
  "My musical identity grew along two parallel paths. The electronic foundation never left. Alongside it, I kept finding new ways to hear and feel.": ["Mi identidad musical creció por dos caminos paralelos. La base electrónica nunca desapareció y, a su lado, fui descubriendo nuevas formas de escuchar y sentir.", "Mon identité musicale s'est développée sur deux voies parallèles. La base électronique est toujours restée. À ses côtés, j'ai découvert d'autres façons d'écouter et de ressentir.", "Meine musikalische Identität entwickelte sich auf zwei parallelen Wegen. Das elektronische Fundament blieb immer bestehen, während ich neue Arten des Hörens und Fühlens entdeckte.", "私の音楽的な個性は、並行する二つの道を通って育ちました。エレクトロニック音楽の原点は今も変わりません。その傍らで、新しい聴き方や感じ方に出会いました。"],
  "The first impact.": ["La primera impresión.", "Le premier choc.", "Der erste Eindruck.", "最初の衝撃。"],
  "Skrillex was where it began. At twelve, I discovered how much energy and emotion could live inside a distorted sound. Electronic music became the foundation of how I listen and produce.": ["Todo empezó con Skrillex. A los doce años descubrí cuánta energía y emoción cabían en un sonido distorsionado. La música electrónica se convirtió en la base de mi forma de escuchar y producir.", "Tout a commencé avec Skrillex. À douze ans, j'ai découvert l'énergie et l'émotion qu'un son saturé pouvait contenir. La musique électronique est devenue la base de mon écoute et de ma production.", "Mit Skrillex fing alles an. Mit zwölf entdeckte ich, wie viel Energie und Gefühl in einem verzerrten Klang stecken können. Elektronische Musik wurde zur Grundlage meines Hörens und Produzierens.", "Skrillexが原点です。12歳のとき、歪んだ音の中にどれほどのエネルギーと感情を込められるかを知りました。エレクトロニック音楽は、聴くことと作ることの土台になりました。"],
  "Beyond the drop.": ["Más allá del drop.", "Au-delà du drop.", "Mehr als der Drop.", "ドロップのその先へ。"],
  "Post Malone and Bring Me the Horizon pulled me toward songs, voices and alternative textures. Their mix of melody, atmosphere and aggression widened my idea of what a track could be.": ["Post Malone y Bring Me the Horizon me acercaron a las canciones, las voces y las texturas alternativas. Su mezcla de melodía, ambiente y energía amplió mi idea de lo que podía ser un tema.", "Post Malone et Bring Me the Horizon m'ont rapproché des chansons, des voix et des textures alternatives. Leur mélange de mélodie, d'atmosphère et d'énergie a élargi ma vision d'un morceau.", "Post Malone und Bring Me the Horizon brachten mich näher an Songs, Stimmen und alternative Klangwelten. Ihre Mischung aus Melodie, Atmosphäre und Energie erweiterte meine Vorstellung von einem Track.", "Post MaloneとBring Me the Horizonに出会い、曲、歌声、オルタナティブな音色に惹かれました。メロディ、空気感、力強さの融合が、楽曲の可能性を広げてくれました。"],
  "Energy, with melody.": ["Energía con melodía.", "De l'énergie et de la mélodie.", "Energie mit Melodie.", "エネルギーにメロディを。"],
  "Marshmello brought a more melodic and accessible side of electronic music into my listening. The digital sound stayed, with more room for a melody to carry the feeling.": ["Marshmello me mostró una faceta más melódica y cercana de la música electrónica. El sonido digital seguía ahí, pero con más espacio para que la melodía transmitiera emociones.", "Marshmello m'a fait découvrir une musique électronique plus mélodique et accessible. Les sonorités numériques restaient présentes, avec plus de place pour l'émotion portée par la mélodie.", "Marshmello eröffnete mir eine melodischere und zugänglichere Seite elektronischer Musik. Der digitale Klang blieb, doch die Melodie bekam mehr Raum, um Gefühle zu tragen.", "Marshmelloの音楽で、よりメロディアスで親しみやすいエレクトロニック音楽に触れました。電子的なサウンドに、感情を伝えるメロディの余地が加わりました。"],
  "Voice comes closer.": ["La voz se acerca.", "La voix se rapproche.", "Die Stimme kommt näher.", "歌声が近づく。"],
  "Fujii Kaze opened a door to R&B, Japanese music and a more expressive, human approach to performance. Joji took that feeling somewhere intimate: fragile melodies, melancholy and space left around a voice.": ["Fujii Kaze me abrió las puertas al R&B, la música japonesa y una interpretación más expresiva y humana. Joji llevó esa sensación a un terreno íntimo, con melodías frágiles, melancolía y espacio alrededor de la voz.", "Fujii Kaze m'a ouvert les portes du R&B, de la musique japonaise et d'une interprétation plus expressive et humaine. Joji a rendu cette émotion intime, avec des mélodies fragiles, de la mélancolie et de l'espace autour de la voix.", "Fujii Kaze öffnete mir den Weg zu R&B, japanischer Musik und einem ausdrucksstärkeren, menschlicheren Auftritt. Joji führte dieses Gefühl in intime Gefilde mit zerbrechlichen Melodien, Melancholie und Raum um die Stimme.", "藤井風をきっかけに、R&B、日本の音楽、より表現豊かで人間味のあるパフォーマンスに触れました。Jojiはその感覚を、繊細なメロディや哀愁、歌声の余白がある親密な世界へ導いてくれました。"],
  "The foundation stays.": ["La base permanece.", "Les racines demeurent.", "Das Fundament bleibt.", "原点は変わらない。"],
  "Dubstep, riddim and color bass stayed with me through the pandemic and into the present. Rushdown, the label and community, alongside Chime and Au5, sharpened my ear for texture, contrast and harmony inside bass music.": ["El dubstep, el riddim y el color bass me acompañaron durante la pandemia y hasta hoy. El sello y la comunidad Rushdown, junto a Chime y Au5, afinaron mi oído para las texturas, los contrastes y la armonía en la música bass.", "Le dubstep, le riddim et la color bass m'ont accompagné pendant la pandémie et jusqu'à aujourd'hui. Le label et la communauté Rushdown, ainsi que Chime et Au5, ont affiné mon oreille aux textures, aux contrastes et à l'harmonie de la bass music.", "Dubstep, Riddim und Color Bass begleiteten mich durch die Pandemie bis heute. Das Label und die Community Rushdown sowie Chime und Au5 schärften mein Gehör für Texturen, Kontraste und Harmonie in der Bassmusik.", "Dubstep、Riddim、Color Bassはパンデミック中から今まで聴き続けています。レーベル兼コミュニティのRushdownやChime、Au5のおかげで、ベースミュージックの音色、対比、ハーモニーをより深く聴くようになりました。"],
  "Moon River changed my listening.": ["Moon River cambió mi forma de escuchar.", "Moon River a changé mon écoute.", "Moon River veränderte mein Hören.", "Moon Riverが聴き方を変えた。"],
  "Watching Jacob Collier perform Moon River changed what I wanted to hear in music. I went through his work and found my favorite artist: harmony, creative freedom and emotion could all belong in the same place.": ["Ver a Jacob Collier interpretar Moon River cambió lo que buscaba en la música. Al explorar su obra encontré a mi artista favorito: la armonía, la libertad creativa y la emoción podían convivir.", "Voir Jacob Collier interpréter Moon River a changé ce que je recherchais dans la musique. En découvrant son œuvre, j'ai trouvé mon artiste préféré : l'harmonie, la liberté créative et l'émotion peuvent coexister.", "Jacob Collier mit Moon River zu sehen, veränderte meine musikalischen Wünsche. Beim Erkunden seiner Werke fand ich meinen Lieblingskünstler: Harmonie, kreative Freiheit und Gefühl können zusammengehören.", "Jacob Collierが「Moon River」を演奏する姿を見て、音楽に求めるものが変わりました。作品を聴き進めて、大好きなアーティストに出会いました。ハーモニー、創造の自由、感情はひとつの場所に共存できると知りました。"],
  "Learning to hear the space.": ["Aprender a escuchar el espacio.", "Apprendre à écouter l'espace.", "Den Raum hören lernen.", "余白を聴く。"],
  "Jacob led me to Keith Jarrett, then to Bill Evans. Piano and jazz taught me to listen to phrasing, improvisation and harmonic tension. Silence and subtlety began to matter as much as impact.": ["Jacob me llevó a Keith Jarrett y luego a Bill Evans. El piano y el jazz me enseñaron a escuchar el fraseo, la improvisación y la tensión armónica. El silencio y los matices empezaron a importarme tanto como la intensidad.", "Jacob m'a mené à Keith Jarrett, puis à Bill Evans. Le piano et le jazz m'ont appris à écouter le phrasé, l'improvisation et la tension harmonique. Le silence et la subtilité comptaient autant que l'impact.", "Jacob führte mich zu Keith Jarrett und dann zu Bill Evans. Klavier und Jazz lehrten mich, auf Phrasierung, Improvisation und harmonische Spannung zu achten. Stille und Feingefühl wurden so wichtig wie Wirkung.", "JacobをきっかけにKeith Jarrett、そしてBill Evansを聴くようになりました。ピアノとジャズから、フレージング、即興、和声の緊張感に耳を傾けることを学びました。静けさや繊細さも、強いインパクトと同じくらい大切になりました。"],
  "Texture becomes a place.": ["La textura se convierte en un lugar.", "La texture devient un lieu.", "Klangtextur wird zum Ort.", "音の質感が場所になる。"],
  "Indie and alternative listening led me toward ambient and experimental music. Oneohtrix Point Never, especially Tranquilizer, made that connection feel personal. More recently, Ryuichi Sakamoto brought me closer to delicate piano, contemplation and quiet emotion.": ["El indie y el rock alternativo me acercaron a la música ambient y experimental. Oneohtrix Point Never, especialmente Tranquilizer, hizo que esa conexión se sintiera propia. Más adelante, Ryuichi Sakamoto me acercó al piano delicado, la contemplación y la emoción serena.", "L'indie et l'alternatif m'ont conduit vers l'ambient et la musique expérimentale. Oneohtrix Point Never, surtout Tranquilizer, a rendu ce lien plus personnel. Plus récemment, Ryuichi Sakamoto m'a rapproché du piano délicat, de la contemplation et d'une émotion paisible.", "Indie und Alternative führten mich zu Ambient und experimenteller Musik. Oneohtrix Point Never, besonders Tranquilizer, machte diese Verbindung persönlich. Später brachte mich Ryuichi Sakamoto näher an einfühlsames Klavierspiel, Kontemplation und stille Emotion.", "インディーやオルタナティブ音楽を通じて、アンビエントや実験音楽に出会いました。特にOneohtrix Point Neverの「Tranquilizer」に深く共感しました。近年は坂本龍一を聴き、繊細なピアノ、思索、静かな感情に惹かれています。"],
  "What I carry into my music.": ["Lo que llevo a mi música.", "Ce que j'apporte à ma musique.", "Was ich in meine Musik mitnehme.", "自分の音楽に生かすもの。"],
  "The energy and sound design of electronic music. The intimacy of R&B. The harmonic curiosity of jazz. The space of ambient music. These paths keep meeting in what I make today.": ["La energía y el diseño sonoro de la música electrónica. La intimidad del R&B. La curiosidad armónica del jazz. El espacio de la música ambient. Todos esos caminos se encuentran en lo que hago hoy.", "L'énergie et le design sonore de l'électronique. L'intimité du R&B. La curiosité harmonique du jazz. L'espace de l'ambient. Tous ces chemins se retrouvent dans ma musique actuelle.", "Energie und Sounddesign elektronischer Musik. Die Intimität des R&B. Die harmonische Neugier des Jazz. Der Raum der Ambient-Musik. All diese Wege treffen sich in meiner heutigen Musik.", "エレクトロニック音楽のエネルギーとサウンドデザイン、R&Bの親密さ、ジャズの和声への好奇心、アンビエントの余白。こうした音楽の道が今の自分の作品の中で交わっています。"],
  "Artist photography / credits": ["Fotografías de los artistas / créditos", "Photos des artistes / crédits", "Künstlerfotos / Bildnachweise", "アーティスト写真・クレジット"],
  "Follow the journey": ["Sigue el recorrido", "Suivre le parcours", "Dem Weg folgen", "音楽の歩みを見る"],
  "Two parallel influences": ["Dos influencias paralelas", "Deux influences parallèles", "Zwei parallele Einflüsse", "二つの音楽的な道"],
  "01 / electronic foundation": ["01 / base electrónica", "01 / racines électroniques", "01 / elektronisches Fundament", "01 / エレクトロニックの原点"],
  "02 / discoveries": ["02 / descubrimientos", "02 / découvertes", "02 / Entdeckungen", "02 / 新しい発見"],
  "02 / discovery": ["02 / descubrimiento", "02 / découverte", "02 / Entdeckung", "02 / 新しい発見"],
  "01 / foundation": ["01 / base", "01 / fondation", "01 / Fundament", "01 / 原点"],
  "the electronic foundation continues": ["la base electrónica continúa", "les racines électroniques perdurent", "das elektronische Fundament bleibt", "エレクトロニック音楽の原点は続く"],
  "Watch Moon River": ["Ver Moon River", "Voir Moon River", "Moon River ansehen", "Moon Riverを見る"],
  "Listen to my music": ["Escucha mi música", "Écouter ma musique", "Meine Musik hören", "私の音楽を聴く"],
  "View image credits": ["Ver créditos de las imágenes", "Voir les crédits des images", "Bildnachweise ansehen", "画像のクレジットを見る"],
  "No contributions on {day}": ["No hay contribuciones el {day}", "Aucune contribution le {day}", "Keine Beiträge am {day}", "{day}のコントリビューションはありません"],
  "{count} contribution on {day}": ["{count} contribución el {day}", "{count} contribution le {day}", "{count} Beitrag am {day}", "{day}に{count}件のコントリビューション"],
  "{count} contributions on {day}": ["{count} contribuciones el {day}", "{count} contributions le {day}", "{count} Beiträge am {day}", "{day}に{count}件のコントリビューション"],
  "Photographs sourced through Wikipedia. Original files, authors and licenses are linked in the image credits.": ["Fotografías obtenidas a través de Wikipedia. Los archivos originales, sus autores y licencias aparecen en los créditos de cada imagen.", "Photographies trouvées sur Wikipédia. Les fichiers originaux, leurs auteurs et leurs licences sont indiqués dans les crédits des images.", "Die Fotos stammen aus Wikipedia. Originaldateien, Urheber und Lizenzen sind bei den jeweiligen Bildnachweisen verlinkt.", "写真はWikipediaから取得しています。元画像、作者、ライセンスは各画像のクレジットに記載しています。"],
  "Real life experience.": ["Experiencia real.", "Expérience sur le terrain.", "Erfahrung aus der Praxis.", "実務経験。"],
  "Backend Engineer @": ["Ingeniero backend en", "Ingénieur backend chez", "Backend-Entwickler bei", "バックエンドエンジニア："],
  "February 2026 – present": ["Febrero de 2026 – actualidad", "Février 2026 – aujourd'hui", "Februar 2026 – heute", "2026年2月～現在"],
  "I build production software for logistics, warehousing, inventory, transportation, and food retail operations. The work crosses business rules, APIs, data and security (roles, users, etc..).": ["Desarrollo software de producción para logística, almacenes, inventario, transporte y comercio alimentario. El trabajo abarca reglas de negocio, APIs, datos y seguridad (roles, usuarios, etc.).", "Je développe des logiciels de production pour la logistique, les entrepôts, les stocks, le transport et le commerce alimentaire. Mon travail couvre les règles métier, les API, les données et la sécurité (rôles, utilisateurs, etc.).", "Ich entwickle produktive Software für Logistik, Lagerhaltung, Bestände, Transport und Lebensmittelhandel. Die Arbeit umfasst Geschäftsregeln, APIs, Daten und Sicherheit (Rollen, Benutzer usw.).", "物流、倉庫、在庫、輸送、食品小売向けの本番用ソフトウェアを開発しています。業務ルール、API、データ、ロールやユーザーなどのセキュリティを扱います。"],
  "Design REST APIs, DTOs, persistence layers, and PostgreSQL migrations with Java and Spring Boot.": ["Diseño APIs REST, DTOs, capas de persistencia y migraciones PostgreSQL con Java y Spring Boot.", "Conception d'API REST, de DTO, de couches de persistance et de migrations PostgreSQL avec Java et Spring Boot.", "Entwurf von REST-APIs, DTOs, Persistenzschichten und PostgreSQL-Migrationen mit Java und Spring Boot.", "JavaとSpring Bootを使ったREST API、DTO、永続化層、PostgreSQLマイグレーションの設計。"],
  "Implement multi-tenant and branch-scoped access using Spring Security, JWT, and RBAC.": ["Implemento acceso multiempresa y por sucursal con Spring Security, JWT y RBAC.", "Mise en place d'accès multi-tenant et par agence avec Spring Security, JWT et RBAC.", "Implementierung mandanten- und filialbezogener Zugriffe mit Spring Security, JWT und RBAC.", "Spring Security、JWT、RBACによるマルチテナント・支店単位のアクセス制御。"],
  "Build workflows for products, inventory management, batches, payments, transfers, reports..": ["Desarrollo flujos para productos, inventarios, lotes, pagos, transferencias e informes.", "Création de processus pour les produits, les stocks, les lots, les paiements, les transferts et les rapports.", "Entwicklung von Abläufen für Produkte, Bestände, Chargen, Zahlungen, Transfers und Berichte.", "商品、在庫、ロット、支払い、振替、レポートの業務フロー開発。"],
  "Skills": ["Habilidades", "Compétences", "Kenntnisse", "スキル"],
  "What I work with.": ["Con lo que trabajo.", "Mes outils de travail.", "Womit ich arbeite.", "使用する技術。"],
  "Frontend, Backend & Programming Languages": ["Frontend, backend y lenguajes de programación", "Frontend, backend et langages de programmation", "Frontend, Backend und Programmiersprachen", "フロントエンド・バックエンド・プログラミング言語"],
  "AI Agents & Code Editors": ["Agentes de IA y editores de código", "Agents IA et éditeurs de code", "KI-Agenten und Code-Editoren", "AIエージェントとコードエディター"],
  "Data, Architecture & Tools": ["Datos, arquitectura y herramientas", "Données, architecture et outils", "Daten, Architektur und Werkzeuge", "データ・アーキテクチャ・ツール"],
  "GitHub profile": ["Perfil de GitHub", "Profil GitHub", "GitHub-Profil", "GitHubプロフィール"],
  "Contributions / last 12 months": ["Contribuciones / últimos 12 meses", "Contributions / 12 derniers mois", "Beiträge / letzte 12 Monate", "コントリビューション / 過去12か月"],
  "contributions": ["contribuciones", "contributions", "Beiträge", "件のコントリビューション"],
  "Daily GitHub contributions, scroll horizontally to view the full year": ["Contribuciones diarias en GitHub; desplázate horizontalmente para ver el año completo", "Contributions quotidiennes sur GitHub ; faites défiler horizontalement pour voir l'année entière", "Tägliche GitHub-Beiträge; horizontal scrollen, um das ganze Jahr zu sehen", "GitHubの日別コントリビューション。横にスクロールすると1年分を表示できます"],
  "Each square is one day. Hover a square for its count. Darker squares indicate more contributions.": ["Cada cuadrado es un día. Pasa el cursor para ver la cantidad. Los más oscuros indican más contribuciones.", "Chaque carré représente un jour. Survolez-le pour voir le nombre. Les carrés foncés indiquent davantage de contributions.", "Jedes Quadrat steht für einen Tag. Darüberfahren zeigt die Anzahl. Dunklere Quadrate bedeuten mehr Beiträge.", "各マスは1日を表します。マスにカーソルを合わせると件数が表示されます。色が濃いほどコントリビューションが多い日です。"],
  "Contribution data is unavailable.": ["Los datos de contribuciones no están disponibles.", "Les données de contribution sont indisponibles.", "Beitragsdaten sind nicht verfügbar.", "コントリビューションデータを取得できません。"],
  "View activity on GitHub ↗": ["Ver actividad en GitHub ↗", "Voir l'activité sur GitHub ↗", "Aktivität auf GitHub ansehen ↗", "GitHubで活動を見る ↗"],
  "Pinned repositories": ["Repositorios fijados", "Dépôts épinglés", "Angeheftete Repositories", "ピン留めリポジトリ"],
  "projects": ["proyectos", "projets", "Projekte", "件のプロジェクト"],
  "Repositories are unavailable right now.": ["Los repositorios no están disponibles ahora.", "Les dépôts sont indisponibles pour le moment.", "Repositories sind gerade nicht verfügbar.", "現在リポジトリを取得できません。"],
  "See them on GitHub ↗": ["Verlos en GitHub ↗", "Les voir sur GitHub ↗", "Auf GitHub ansehen ↗", "GitHubで見る ↗"],
  "Project": ["Proyecto", "Projet", "Projekt", "プロジェクト"],
  "No description on GitHub.": ["Sin descripción en GitHub.", "Aucune description sur GitHub.", "Keine Beschreibung auf GitHub.", "GitHubに説明がありません。"],
  "Software for renaming songs and attaching missing metadata.": ["Software para renombrar canciones y añadir metadatos faltantes.", "Logiciel pour renommer des chansons et ajouter les métadonnées manquantes.", "Software zum Umbenennen von Liedern und Ergänzen fehlender Metadaten.", "曲の名前変更や不足したメタデータの追加を行うソフトウェア。"],
  "Kotlin made Synth and files generator.": ["Sintetizador y generador de archivos desarrollado en Kotlin.", "Synthétiseur et générateur de fichiers réalisé en Kotlin.", "Mit Kotlin entwickelter Synthesizer und Dateigenerator.", "Kotlin製のシンセサイザーとファイル生成ツール。"],
  "ICU discrete-event simulation engine": ["Motor de simulación de eventos discretos para UCI", "Moteur de simulation à événements discrets pour les soins intensifs", "Diskrete Ereignissimulation für die Intensivpflege", "集中治療室向け離散事象シミュレーションエンジン"],
  "Tetris clone made in Java using native components (discontinued).": ["Clon de Tetris desarrollado en Java con componentes nativos (proyecto discontinuado).", "Clone de Tetris réalisé en Java avec des composants natifs (projet abandonné).", "Tetris-Klon mit nativen Java-Komponenten (eingestellt).", "Javaの標準コンポーネントを使ったテトリスのクローン（開発終了）。"],
  "Config files for my stuff.": ["Archivos de configuración para mis herramientas.", "Fichiers de configuration de mes outils.", "Konfigurationsdateien für meine Sachen.", "各種ツールの設定ファイル。"],
  "← Back to profile": ["← Volver al perfil", "← Retour au profil", "← Zurück zum Profil", "← プロフィールに戻る"],
  "00 / contact": ["00 / contacto", "00 / contact", "00 / Kontakt", "00 / お問い合わせ"],
  "Send a message": ["Envía un mensaje", "Envoyer un message", "Nachricht senden", "メッセージを送る"],
  "Write to me about a project, music, or anything you'd like to propose.": ["Escríbeme sobre un proyecto, música o cualquier propuesta que tengas.", "Écrivez-moi au sujet d'un projet, de musique ou de toute autre proposition.", "Schreib mir über ein Projekt, Musik oder einen anderen Vorschlag.", "プロジェクト、音楽、その他のご提案について私にメッセージを送ってください。"],
  "Name": ["Nombre", "Nom", "Name", "名前"],
  "Email": ["Correo electrónico", "E-mail", "E-Mail", "メールアドレス"],
  "Message": ["Mensaje", "Message", "Nachricht", "メッセージ"],
  "10–5,000 characters.": ["Entre 10 y 5000 caracteres.", "Entre 10 et 5 000 caractères.", "10–5.000 Zeichen.", "10～5,000文字。"],
  "Leave this empty": ["Deja esto vacío", "Laissez ce champ vide", "Dieses Feld leer lassen", "空欄のままにしてください"],
  "Enter your name.": ["Escribe tu nombre.", "Saisissez votre nom.", "Gib deinen Namen ein.", "名前を入力してください。"],
  "Write at least 10 characters.": ["Escribe al menos 10 caracteres.", "Écrivez au moins 10 caractères.", "Schreibe mindestens 10 Zeichen.", "10文字以上入力してください。"],
  "Review the highlighted fields.": ["Revisa los campos señalados.", "Vérifiez les champs signalés.", "Überprüfe die markierten Felder.", "強調表示された項目を確認してください。"],
  "Your details are used to deliver this message and reply to you. The site removes successfully processed messages after 30 days; failed deliveries remain for review. Email providers, backups, and the recipient's mailbox keep their own copies.": ["Tus datos se usan para entregar este mensaje y responderte. El sitio elimina los mensajes procesados correctamente después de 30 días; los envíos fallidos se conservan para revisión. Los proveedores de correo, las copias de seguridad y el buzón del destinatario conservan sus propias copias.", "Vos données servent à transmettre ce message et à vous répondre. Le site supprime les messages traités avec succès après 30 jours ; les échecs sont conservés pour vérification. Les fournisseurs de messagerie, les sauvegardes et la boîte du destinataire conservent leurs propres copies.", "Deine Angaben dienen zur Zustellung dieser Nachricht und zur Antwort. Erfolgreich verarbeitete Nachrichten werden nach 30 Tagen gelöscht; fehlgeschlagene Zustellungen bleiben zur Prüfung gespeichert. E-Mail-Anbieter, Sicherungen und das Postfach des Empfängers behalten eigene Kopien.", "入力情報はメッセージの配信と返信に使用します。正常に処理されたメッセージは30日後にサイトから削除し、配信失敗分は確認のため保持します。メールサービス、バックアップ、受信者のメールボックスにはそれぞれコピーが残ります。"],
  "Sending…": ["Enviando…", "Envoi…", "Wird gesendet…", "送信中…"],
  "Send message ↗": ["Enviar mensaje ↗", "Envoyer le message ↗", "Nachricht senden ↗", "メッセージを送信 ↗"],
  "Submitting your message…": ["Enviando tu mensaje…", "Transmission de votre message…", "Deine Nachricht wird übermittelt…", "メッセージを送信しています…"],
  "The service is taking a little longer to respond. Please keep this page open; your message is still here.": ["El servicio está tardando un poco más en responder. Mantén esta página abierta; tu mensaje sigue aquí.", "Le service met un peu plus de temps à répondre. Gardez cette page ouverte ; votre message est toujours là.", "Der Dienst braucht etwas länger. Lass diese Seite bitte geöffnet; deine Nachricht ist noch hier.", "サービスの応答に少し時間がかかっています。このページを開いたままお待ちください。メッセージは保持されています。"],
  "We could not confirm receipt. Your text is still here. Retry with the same content to avoid duplicates; editing it creates a new submission.": ["No pudimos confirmar la recepción. Tu texto sigue aquí. Reintenta con el mismo contenido para evitar duplicados; si lo editas se crea un nuevo envío.", "Nous n'avons pas pu confirmer la réception. Votre texte est toujours là. Réessayez avec le même contenu pour éviter les doublons ; toute modification crée un nouvel envoi.", "Der Empfang konnte nicht bestätigt werden. Dein Text ist noch hier. Versuche es mit demselben Inhalt erneut, um Duplikate zu vermeiden; Änderungen erzeugen eine neue Einsendung.", "受信を確認できませんでした。入力内容は保持されています。重複を避けるため、同じ内容で再試行してください。編集すると新しい送信として扱われます。"],
  "Your message has been received for delivery.": ["Tu mensaje se ha recibido para su entrega.", "Votre message a été reçu pour transmission.", "Deine Nachricht wurde zur Zustellung empfangen.", "配信のためメッセージを受け付けました。"],
  "Reference:": ["Referencia:", "Référence :", "Referenz:", "受付番号："],
  "01 / music": ["01 / música", "01 / musique", "01 / Musik", "01 / 音楽"],
  "sounds i've crafted": ["sonidos que he creado", "les sons que j'ai créés", "Klänge, die ich geschaffen habe", "私がつくった音"],
  "Here are my original tracks and releases. Listen, rate or maybe and leave some comments for those work in progress stuff. I've also have some influences and some story telling about my experiencie.": ["Aquí están mis temas y lanzamientos originales. Escucha, valora y deja tus comentarios sobre los trabajos en proceso. También comparto mis influencias e historias sobre mi experiencia.", "Voici mes morceaux et sorties originales. Écoutez, notez et laissez des commentaires sur les travaux en cours. Je partage aussi mes influences et quelques histoires sur mon parcours.", "Hier sind meine eigenen Tracks und Veröffentlichungen. Hör rein, bewerte sie und kommentiere die laufenden Arbeiten. Außerdem teile ich meine Einflüsse und Geschichten aus meiner Erfahrung.", "オリジナル楽曲とリリースを紹介します。試聴、評価、制作途中の作品へのコメントをお楽しみください。影響を受けた音楽や経験についても紹介しています。"],
  "Music platforms": ["Plataformas de música", "Plateformes musicales", "Musikplattformen", "音楽プラットフォーム"],
  "Where to reach me": ["Dónde encontrarme", "Où me retrouver", "Wo du mich findest", "私を見つけられる場所"],
  "Platforms and links": ["Plataformas y enlaces", "Plateformes et liens", "Plattformen und Links", "プラットフォームとリンク"],
  "albums": ["álbumes", "albums", "Alben", "アルバム"],
  "album": ["álbum", "album", "Album", "アルバム"],
  "listen on": ["escuchar en", "écouter sur", "anhören auf", "再生先"],
  "loading albums...": ["cargando álbumes...", "chargement des albums...", "Alben werden geladen...", "アルバムを読み込み中..."],
  "no albums connected yet.": ["aún no hay álbumes conectados.", "aucun album connecté pour le moment.", "noch keine Alben verbunden.", "まだアルバムが登録されていません。"],
  "wip tracks": ["temas en proceso", "morceaux en cours", "Tracks in Arbeit", "制作中の楽曲"],
  "No tracks available.": ["No hay temas disponibles.", "Aucun morceau disponible.", "Keine Tracks verfügbar.", "楽曲がありません。"],
  "play": ["reproducir", "lire", "abspielen", "再生"],
  "pause": ["pausar", "pause", "pausieren", "一時停止"],
  "seek": ["posición de reproducción", "position de lecture", "Wiedergabeposition", "再生位置"],
  "playback error: could not stream this track. check your internet connectivity.": ["error de reproducción: no se pudo reproducir este tema. Comprueba tu conexión.", "erreur de lecture : impossible de lire ce morceau. Vérifiez votre connexion.", "Wiedergabefehler: Dieser Track konnte nicht abgespielt werden. Prüfe deine Verbindung.", "再生エラー：この楽曲を再生できません。接続を確認してください。"],
  "Loading tracks...": ["Cargando temas...", "Chargement des morceaux...", "Tracks werden geladen...", "楽曲を読み込み中..."],
  "The server is ready.": ["El servidor está listo.", "Le serveur est prêt.", "Der Server ist bereit.", "サーバーの準備ができました。"],
  "connecting to the server...": ["conectando con el servidor...", "connexion au serveur...", "Verbindung zum Server...", "サーバーに接続中..."],
  "Starting the server...": ["Iniciando el servidor...", "Démarrage du serveur...", "Server wird gestartet...", "サーバーを起動中..."],
  "The first request may take up to a minute.": ["La primera solicitud puede tardar hasta un minuto.", "La première requête peut prendre jusqu'à une minute.", "Die erste Anfrage kann bis zu einer Minute dauern.", "初回のリクエストには最大1分かかる場合があります。"],
  "Waiting for the server...": ["Esperando al servidor...", "En attente du serveur...", "Warten auf den Server...", "サーバーの応答を待っています..."],
  "Tracks will load when the connection is ready.": ["Los temas cargarán cuando la conexión esté lista.", "Les morceaux se chargeront dès que la connexion sera prête.", "Die Tracks laden, sobald die Verbindung bereit ist.", "接続ができ次第、楽曲を読み込みます。"],
  "If this continues, reload the page.": ["Si esto continúa, recarga la página.", "Si cela continue, rechargez la page.", "Wenn das anhält, lade die Seite neu.", "この状態が続く場合はページを再読み込みしてください。"],
  "unrated": ["sin valorar", "non noté", "unbewertet", "未評価"],
  "comments": ["comentarios", "commentaires", "Kommentare", "コメント"],
  "vote": ["votar", "noter", "bewerten", "評価"],
  "(edited)": ["(editado)", "(modifié)", "(bearbeitet)", "（編集済み）"],
  "save": ["guardar", "enregistrer", "speichern", "保存"],
  "cancel": ["cancelar", "annuler", "abbrechen", "キャンセル"],
  "edit": ["editar", "modifier", "bearbeiten", "編集"],
  "no comments yet.": ["aún no hay comentarios.", "aucun commentaire pour le moment.", "noch keine Kommentare.", "まだコメントはありません。"],
  "your name": ["tu nombre", "votre nom", "dein Name", "名前"],
  "leave comment": ["deja un comentario", "laisser un commentaire", "Kommentar schreiben", "コメントを入力"],
  "publish": ["publicar", "publier", "veröffentlichen", "投稿"],
  "retry": ["reintentar", "réessayer", "erneut versuchen", "再試行"],
  "technical details": ["detalles técnicos", "détails techniques", "technische Details", "技術情報"],
  "Something went wrong. Try again.": ["Algo salió mal. Inténtalo de nuevo.", "Une erreur s'est produite. Réessayez.", "Etwas ist schiefgelaufen. Versuche es erneut.", "エラーが発生しました。もう一度お試しください。"],
  "We couldn't reach the server. Check your connection and try again.": ["No pudimos conectar con el servidor. Comprueba tu conexión y reintenta.", "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "Der Server ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.", "サーバーに接続できません。接続を確認して再試行してください。"],
  "Something went wrong on our side. Try again in a few minutes.": ["Ocurrió un error de nuestro lado. Reintenta en unos minutos.", "Une erreur est survenue de notre côté. Réessayez dans quelques minutes.", "Bei uns ist ein Fehler aufgetreten. Versuche es in wenigen Minuten erneut.", "サーバー側でエラーが発生しました。数分後に再試行してください。"],
  "Audio storage is unreachable right now. Try again in a few minutes.": ["El almacenamiento de audio no está disponible. Reintenta en unos minutos.", "Le stockage audio est inaccessible. Réessayez dans quelques minutes.", "Der Audiospeicher ist gerade nicht erreichbar. Versuche es in wenigen Minuten erneut.", "音声ストレージに接続できません。数分後に再試行してください。"],
  "The service is under maintenance. Try again later.": ["El servicio está en mantenimiento. Reintenta más tarde.", "Le service est en maintenance. Réessayez plus tard.", "Der Dienst wird gewartet. Versuche es später erneut.", "メンテナンス中です。しばらくしてから再試行してください。"],
  "The server took too long to respond. Try again.": ["El servidor tardó demasiado en responder. Reintenta.", "Le serveur a mis trop de temps à répondre. Réessayez.", "Der Server hat zu lange gebraucht. Versuche es erneut.", "サーバーの応答がタイムアウトしました。再試行してください。"],
  "04 / experiments": ["04 / experimentos", "04 / expériences", "04 / Experimente", "04 / 実験"],
  "Experiments": ["Experimentos", "Expériences", "Experimente", "実験"],
  "Interactive studies in simulation, geometry, and color.": ["Estudios interactivos de simulación, geometría y color.", "Études interactives de simulation, géométrie et couleur.", "Interaktive Studien zu Simulation, Geometrie und Farbe.", "シミュレーション、幾何学、色彩のインタラクティブな研究。"],
  "study": ["estudio", "étude", "Studie", "研究"],
  "Fluid simulation with pigment mixing.": ["Simulación de fluidos con mezcla de pigmentos.", "Simulation de fluides avec mélange de pigments.", "Fluidsimulation mit Pigmentmischung.", "顔料の混合を伴う流体シミュレーション。"],
  "Recursive rectangle partitioning with adjustable geometry and color.": ["Partición recursiva de rectángulos con geometría y color ajustables.", "Partition récursive de rectangles avec géométrie et couleur réglables.", "Rekursive Rechteckteilung mit einstellbarer Geometrie und Farbe.", "幾何学と色を調整できる長方形の再帰分割。"],
  "← all experiments": ["← todos los experimentos", "← toutes les expériences", "← alle Experimente", "← すべての実験"],
  "Adjust the flow and pigment palette. Drag on the canvas to stir the fluid.": ["Ajusta el flujo y la paleta de pigmentos. Arrastra sobre el lienzo para agitar el fluido.", "Réglez le flux et la palette de pigments. Faites glisser sur la toile pour remuer le fluide.", "Passe Strömung und Pigmentpalette an. Ziehe auf der Fläche, um die Flüssigkeit zu bewegen.", "流れと顔料パレットを調整できます。キャンバス上でドラッグして流体をかき混ぜてください。"],
  "Adjust depth, cut ratio, and palette to generate rectangle partitions.": ["Ajusta la profundidad, la proporción de corte y la paleta para generar particiones rectangulares.", "Réglez la profondeur, le rapport de coupe et la palette pour générer des partitions rectangulaires.", "Passe Tiefe, Schnittverhältnis und Palette an, um Rechteckteilungen zu erzeugen.", "深さ、分割比率、パレットを調整して長方形の分割を生成します。"],
  "partition": ["partición", "partition", "Teilung", "分割"],
  "depth": ["profundidad", "profondeur", "Tiefe", "深さ"],
  "irregularity": ["irregularidad", "irrégularité", "Unregelmäßigkeit", "不規則性"],
  "grain": ["grano", "grain", "Körnung", "粒度"],
  "long side bias": ["preferencia por el lado largo", "préférence pour le côté long", "Bevorzugung der langen Seite", "長辺の優先度"],
  "how often a cell inherits its parent's cut direction": ["frecuencia con la que una celda hereda la dirección de corte de su padre", "fréquence à laquelle une cellule hérite de la direction de coupe de son parent", "wie oft eine Zelle die Schnittrichtung ihrer Elternzelle übernimmt", "親セルの分割方向を引き継ぐ頻度"],
  "preference, not a rule: 1 cuts the longer side 85% of the time": ["preferencia, no regla: 1 corta el lado largo el 85 % de las veces", "préférence, pas une règle : 1 coupe le côté long dans 85 % des cas", "Vorliebe, keine Regel: 1 schneidet in 85 % der Fälle die längere Seite", "ルールではなく傾向です。1では85%の確率で長辺を分割します"],
  "colour": ["color", "couleur", "Farbe", "色"],
  "base hue": ["tono base", "teinte de base", "Grundfarbton", "基本色相"],
  "harmony": ["armonía", "harmonie", "Harmonie", "配色"],
  "hue spread": ["amplitud de tonos", "écart des teintes", "Farbtonspreizung", "色相の幅"],
  "light ramp": ["gradación de luz", "dégradé de lumière", "Helligkeitsverlauf", "明度の勾配"],
  "colour variance": ["variación de color", "variation de couleur", "Farbvariation", "色のばらつき"],
  "0 uses a position-based gradient; 1 increases random color variation": ["0 usa un degradado según la posición; 1 aumenta la variación aleatoria del color", "0 utilise un dégradé selon la position ; 1 augmente la variation aléatoire des couleurs", "0 nutzt einen positionsabhängigen Verlauf; 1 erhöht die zufällige Farbvariation", "0は位置に基づくグラデーション、1はランダムな色の変化を増やします"],
  "bare paper": ["papel sin pintar", "papier vierge", "unbemaltes Papier", "未塗装部分"],
  "chance a cell is left unpainted": ["probabilidad de que una celda quede sin pintar", "probabilité qu'une cellule reste vierge", "Wahrscheinlichkeit, dass eine Zelle unbemalt bleibt", "セルを塗らずに残す確率"],
  "output": ["resultado", "résultat", "Ausgabe", "出力"],
  "animate": ["animar", "animer", "animieren", "アニメーション"],
  "recut": ["volver a dividir", "redécouper", "neu teilen", "再分割"],
  "board": ["lienzo", "toile", "Fläche", "キャンバス"],
  "reset": ["reiniciar", "réinitialiser", "zurücksetzen", "リセット"],
  "hide": ["ocultar", "masquer", "ausblenden", "非表示"],
  "presets": ["preajustes", "préréglages", "Voreinstellungen", "プリセット"],
  "load": ["cargar", "charger", "laden", "読み込み"],
  "reroll": ["otra variación", "nouvelle variation", "neu würfeln", "ランダムに変更"],
  "hue": ["tono", "teinte", "Farbton", "色相"],
  "chroma": ["croma", "chroma", "Chroma", "彩度"],
  "spread": ["amplitud", "écart", "Spreizung", "広がり"],
  "ramp": ["gradación", "dégradé", "Verlauf", "勾配"],
  "motion": ["movimiento", "mouvement", "Bewegung", "動き"],
  "flow": ["flujo", "flux", "Strömung", "流れ"],
  "heading": ["dirección", "direction", "Richtung", "方向"],
  "turbulence": ["turbulencia", "turbulence", "Turbulenz", "乱流"],
  "speed": ["velocidad", "vitesse", "Geschwindigkeit", "速度"],
  "density": ["densidad", "densité", "Dichte", "密度"],
  "sweep": ["barrido", "balayage", "Schwenk", "スイープ"],
  "wash": ["lavado", "lavage", "Auswaschung", "洗い流し"],
  "velocity damping": ["amortiguación de velocidad", "amortissement de vitesse", "Geschwindigkeitsdämpfung", "速度減衰"],
  "iterations": ["iteraciones", "itérations", "Iterationen", "反復回数"],
  "Advanced controls": ["Controles avanzados", "Réglages avancés", "Erweiterte Einstellungen", "詳細設定"],
  "pointer": ["puntero", "pointeur", "Zeiger", "ポインター"],
  "stir with pointer": ["agitar con el puntero", "remuer avec le pointeur", "mit dem Zeiger rühren", "ポインターでかき混ぜる"],
  "pointer force": ["fuerza del puntero", "force du pointeur", "Zeigerkraft", "ポインターの力"],
  "pointer radius": ["radio del puntero", "rayon du pointeur", "Zeigerradius", "ポインターの半径"],
  "pointer deposit": ["depósito del puntero", "dépôt du pointeur", "Zeigerauftrag", "ポインターの顔料量"],
  "pigment dropped under the pointer, per second. 0 stirs without colouring.": ["pigmento depositado bajo el puntero por segundo. 0 agita sin colorear.", "pigment déposé sous le pointeur par seconde. 0 remue sans colorer.", "Pigmentauftrag unter dem Zeiger pro Sekunde. 0 rührt ohne Farbe.", "ポインター下に毎秒置く顔料の量。0では色を加えずにかき混ぜます。"],
  "tracers": ["trazadores", "traceurs", "Spurpartikel", "トレーサー"],
  "tracer count": ["cantidad de trazadores", "nombre de traceurs", "Partikelanzahl", "トレーサー数"],
  "tracer tail": ["estela de trazadores", "traînée des traceurs", "Spurlänge", "軌跡の長さ"],
  "tracer life": ["duración de trazadores", "durée des traceurs", "Partikellebensdauer", "トレーサーの寿命"],
  "surface": ["superficie", "surface", "Oberfläche", "表面"],
  "relief": ["relieve", "relief", "Relief", "凹凸"],
  "lights the pigment by its own thickness.": ["ilumina el pigmento según su grosor.", "éclaire le pigment selon son épaisseur.", "beleuchtet das Pigment nach seiner Dicke.", "顔料の厚みに応じて照明を付けます。"],
  "field view": ["vista del campo", "vue du champ", "Feldansicht", "場の表示"],
  "field gain": ["ganancia del campo", "gain du champ", "Feldverstärkung", "場のゲイン"],
  "view": ["vista", "vue", "Ansicht", "表示"],
  "detail": ["detalle", "détail", "Detail", "詳細度"],
  "zoom": ["zoom", "zoom", "Zoom", "ズーム"],
  "reset view": ["restablecer vista", "réinitialiser la vue", "Ansicht zurücksetzen", "表示をリセット"],
  "keys": ["teclas", "touches", "Tasten", "キー操作"],
  "reset board": ["reiniciar lienzo", "réinitialiser la toile", "Fläche zurücksetzen", "キャンバスをリセット"],
  "pointer stirs": ["agitar con el puntero", "agiter au pointeur", "Zeiger rührt", "ポインターでかき混ぜる"],
  "pan": ["desplazar", "déplacer", "verschieben", "移動"],
  "mono": ["monocromática", "monochrome", "monochrom", "単色"],
  "analogous": ["análoga", "analogue", "analog", "類似色"],
  "complement": ["complementaria", "complémentaire", "komplementär", "補色"],
  "split": ["complementaria dividida", "complémentaire divisée", "geteilt komplementär", "分裂補色"],
  "triad": ["tríada", "triade", "Triade", "三色配色"],
  "tetrad": ["tétrada", "tétrade", "Tetrade", "四色配色"],
  "triadic": ["triádica", "triadique", "triadisch", "三色配色"],
  "tetradic": ["tetrádica", "tétradique", "tetradisch", "四色配色"],
  "tide": ["marea", "marée", "Gezeiten", "潮流"],
  "storm": ["tormenta", "tempête", "Sturm", "嵐"],
  "silt": ["sedimento", "sédiment", "Sediment", "堆積"],
  "orbit": ["órbita", "orbite", "Umlaufbahn", "軌道"],
  "ink": ["tinta", "encre", "Tinte", "インク"],
  "survey": ["exploración", "exploration", "Erkundung", "探索"],
  "off": ["desactivado", "désactivé", "aus", "オフ"],
  "low": ["bajo", "faible", "niedrig", "低"],
  "medium": ["medio", "moyen", "mittel", "中"],
  "high": ["alto", "élevé", "hoch", "高"],
  "ultra": ["ultra", "ultra", "ultra", "最高"],
  "full": ["completo", "complet", "voll", "全画面"],
  "velocity": ["velocidad", "vitesse", "Geschwindigkeit", "速度"],
  "pressure": ["presión", "pression", "Druck", "圧力"],
  "curl": ["rotación", "rotationnel", "Rotation", "渦度"],
  "divergence": ["divergencia", "divergence", "Divergenz", "発散"],
};

const columns = { es: 0, fr: 1, de: 2, ja: 3 } as const;

const patterns = Object.keys(messages).filter(key => key.includes("{")).map(key => ({
  key,
  names: [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1]),
  expression: new RegExp("^" + key.split(/(\{\w+\})/).map(part => /^\{\w+\}$/.test(part)
    ? "(.+?)" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$"),
}));

export function translate<T>(value: T, locale: Locale): T | string {
  if (typeof value !== "string" || locale === "en") return value;
  const key = value.replace(/\s+/g, " ").trim();
  const translated = messages[key]?.[columns[locale]];
  if (translated) return value.replace(/\S[\s\S]*\S|\S/, translated);
  for (const pattern of patterns) {
    const match = key.match(pattern.expression);
    if (!match) continue;
    let result = messages[pattern.key]?.[columns[locale]] ?? key;
    pattern.names.forEach((name, index) => { result = result.replace(`{${name}}`, match[index + 1] ?? ""); });
    return result;
  }
  const numbered = key.match(/^(\d+\s*\/\s*)(study)$/);
  if (numbered) return `${numbered[1]}${translate("study", locale)}`;
  return value;
}
