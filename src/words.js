/* Memory Palace: the word bank for training. Concrete words are things you can picture at once; abstract words have
   no picture of their own, so you have to invent one (they join the mix from day 20). All of it ships with the app:
   nothing is fetched. Lists are drawn without repeats until the bank runs out, then it starts over. */
(function () {
  'use strict';
  var MP = window.MP;
  var CONCRETE = ('anvil otter lighthouse kettle saddle violin lantern pumpkin anchor beehive canoe cactus walrus trumpet ' +
    'helmet pineapple tractor feather igloo jellyfish kayak ladder magnet necklace octopus parachute quilt robot scarecrow ' +
    'telescope umbrella volcano wagon xylophone yacht zipper acorn balloon candle dagger elephant fountain giraffe hammock ' +
    'iceberg jigsaw kangaroo lemon mitten noodle orchid penguin rocket sandal tiger unicorn vulture waffle backpack bagpipe ' +
    'banjo barrel basket bathtub battery beard bicycle blanket blender bonfire boomerang bottle bracelet bucket bulldozer ' +
    'butterfly cabbage cage camel cannon carrot castle caterpillar cauldron chain chandelier cherry chimney chisel cigar ' +
    'clock cloud coconut coffin comb compass cork corn cowboy crab crayon crocodile crown crystal cucumber cupcake curtain ' +
    'cushion dart desk diamond dice dinosaur dolphin donkey donut dragon drum duck eagle easel egg envelope eraser fan ' +
    'faucet fence ferry fiddle fire flag flamingo flashlight flute football fork fossil fox frog garlic geyser ghost glacier ' +
    'glove goat goblet goose gorilla grape grasshopper guitar hamster harp hatchet hedgehog helicopter hippo honey horn ' +
    'horseshoe hose hourglass hydrant iguana ink jacket jar jeep jewel kite kitten knife knot koala ladle lamb lasso leaf ' +
    'leopard lettuce lion lipstick lizard lobster lock locomotive log lollipop mailbox mango map mask match mattress medal ' +
    'melon microphone microscope mirror monkey moose mop mosquito motorcycle mountain mouse muffin mushroom nail nest net ' +
    'nutcracker oar onion orange ostrich oven owl oyster paddle paintbrush pajamas pancake panda parrot peach peacock pear ' +
    'pearl pebble pelican pencil pepper piano pickle pig pillow pine pipe pirate pistol pizza plank plate plum pocket ' +
    'pogo pond popcorn porcupine potato pretzel pudding puppet puppy pyramid rabbit raccoon radio raft rainbow rake rat ' +
    'razor rhino ribbon rice ring river rope rose ruby rug ruler sack sail salmon sandwich sausage saw saxophone scissors ' +
    'scorpion seal seesaw shark sheep shell shield ship shoe shovel skateboard skeleton ski skull skunk sled slipper snail ' +
    'snake snowman soap sock sofa spider spinach sponge spoon squid squirrel stamp starfish statue stethoscope stool ' +
    'strawberry submarine suitcase sunflower swan sword syringe table taco tank teapot teddy tent thimble throne thumbtack ' +
    'ticket tire toaster toilet tomato tongs toothbrush torch tornado tortoise towel trampoline treasure trophy truck ' +
    'trunk tuba tulip turkey turtle tweezers typewriter vase vest vine violet wallet walnut wand wardrobe wasp watch ' +
    'watermelon whale wheel whistle wig windmill witch wolf worm wreath wrench yarn yoyo zebra apron arrow axe bakery ' +
    'bamboo bandage bat beach bell bench blimp bone book boot bow bowl box bread bridge broom brush bubble bull cake ' +
    'camera canyon cape car cat chair cheese chess chicken chocolate cinema circus cliff coat cobweb coin cookie cow crane ' +
    'crow cup dam deer dog door dove dress drill eel engine feather fireman fish forest fridge galaxy garden gem glass ' +
    'globe gold grenade hat hawk heart helmet hen hive hook horse ice island jam kettle key king knight lake lamp lava ' +
    'library lily magician marble meteor milk mine moon moth nurse ocean ogre oil painting palace parrot pen pie planet ' +
    'pliers potion prince queen quarry rain reindeer rocket roof sailor salt sand satellite saucer scarf school seed ' +
    'shadow shower skyscraper smoke snow soldier soup spear stadium star steak stone storm sun swamp sweater tail tea ' +
    'thunder tooth tower toy train tree tunnel valley vampire waiter waterfall wave web wedding well wheelbarrow wind ' +
    'window wine wing wizard zoo').split(' ');
  var ABSTRACT = ('justice rumor often freedom honesty envy patience courage mercy gossip luck wisdom doubt pride shame ' +
    'trust fear hope greed grief joy anger boredom chaos comfort curiosity danger debt delay desire destiny devotion ' +
    'dignity duty echo effort energy error escape faith fame fate fury glory gratitude guilt habit harmony haste hatred ' +
    'honor humor hunger idea illusion impulse instinct irony jealousy kindness knowledge labor liberty logic loyalty ' +
    'madness memory method mischief mood motive mystery nonsense notion oath order pain panic paradox peace permission ' +
    'pity pleasure poverty power praise privacy progress promise purpose quality rage reason regret relief revenge ' +
    'rhythm risk rivalry sarcasm secret silence sincerity skill sorrow spite status strategy strength success surprise ' +
    'suspicion talent temper tension theory thrill tradition triumph truth tyranny urgency valor vanity victory virtue ' +
    'vision warmth weakness whim wonder worry youth zeal always maybe never soon later almost perhaps instead despite ' +
    'although beyond within between during except unless whereas balance blame burden chance choice claim concept ' +
    'conflict consent context crisis custom decision defeat effect emotion equality ethics evidence excuse failure ' +
    'focus guess hint identity influence insight intent interest justice limit loss meaning mistake moment opinion ' +
    'origin outcome patience pattern policy prestige principle priority problem question rank reform response ' +
    'result rule sense theme threat value').split(' ');
  function dedupe(a) { var seen = {}; return a.filter(function (w) { if (!w || seen[w]) return false; seen[w] = 1; return true; }); }
  CONCRETE = dedupe(CONCRETE); ABSTRACT = dedupe(ABSTRACT).filter(function (w) { return CONCRETE.indexOf(w) < 0; });

  // Draw n words of a kind, avoiding the ones used most recently (kept on this headset in the training state).
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  MP.Words = {
    concrete: CONCRETE, abstract: ABSTRACT,
    draw: function (kind, n, used, seed) {
      var bank = kind === 'abstract' ? ABSTRACT : CONCRETE, rnd = MP.rng(seed || (Date.now() & 0x7fffffff));
      used = used || {};
      var fresh = bank.filter(function (w) { return !used[w]; });
      if (fresh.length < n) { fresh = bank.slice(); Object.keys(used).forEach(function (w) { if (bank.indexOf(w) >= 0) delete used[w]; }); }
      var out = shuffle(fresh, rnd).slice(0, n); out.forEach(function (w) { used[w] = 1; });
      return out;
    }
  };
})();
