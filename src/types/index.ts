interface BaseBuyer {
    balance: number;
}

interface BuyerWithoutAge extends BaseBuyer {
    age: null;
}

interface BuyerWithAge extends BaseBuyer {
    age: number;
}

interface BaseDrink {
    name: string;
    cost: number;
}

interface AlcoholicDrink extends BaseDrink {
    alcoholic: true;
}

interface NonAlcoholicDrink extends BaseDrink {
    alcoholic: false;
}

export type Drink = AlcoholicDrink | NonAlcoholicDrink;

export type ServeDrinkInput =
    | {
          drink: AlcoholicDrink;
          buyer: BuyerWithAge;
      }
    | {
          drink: NonAlcoholicDrink;
          buyer: BuyerWithoutAge;
      };
