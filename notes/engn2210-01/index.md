---
title: Continuum Mechanics 01
date: '2026-09-13'
description: Mathematical preliminaries about vector spaces 
tags: [Coursework]
language: en
draft: false
---

This is the first entry in my note series for **ENGN 2210: Continuum Mechanics**. The course is taught by my PhD advisor, **Prof. Kesari**, with the first two lectures guest-taught by my labmate **Aashutosh**. Course materials will be available on [the course website](https://akulakar.github.io/ENGN2210-ContinuumMechanics-Fall2026/).

*Nonlinear Solid Mechanics* by Prof. Holzapfel is one of the recommended textbooks for this course, which I read thoroughly during my Master's. Therefore, instead of transcribing all the standard lecture notes, I will focus on documenting the subtle, tricky, or potentially confusing points that come up in class or in the course materials.

The first lecture focuses on the definitions and axioms of vector spaces. I will structure this post section by section, detailing each question along with my thought process and solutions.

## Real Vector Space

> **Definition 2.1 Real vector space**

What is a space? A space is just a set whose elements obey rules strictly. "Real vector space" means the elements are all real number vectors. This definition is always taken for granted, that's true. Then, the operations between real vectors are defined, for example, the commutative law of addition, associative law of addition, commutative and associative laws of scalar multiplication, the existence of the zero element, naturally the existence of negative elements (elements that yield the zero element when added to a given element), and finally the distributive law of scalar multiplication.

The above axioms are defined, and these properties must always be satisfied for any real vector space. Then, several identities can be derived using these axioms, which are straightforward and easy to understand.

> **Definition 2.2 Subspace**

I used to find the concept of subspaces somewhat tricky. For some vector spaces, it is not always easy to immediately come up with a valid subspace. A subset $\mathcal U \subseteq \mathcal V$ is called a subspace of $\mathcal V$ if $\mathcal U$ is itself a vector space **under the same vector addition and scalar multiplication** as those defined on $\mathcal V$.

From the perspective of sets, $\mathcal U \subseteq \mathcal V$. From the perspective of vector spaces, $\mathcal U$ must be **closed under vector addition and scalar multiplication**. That is, for any $\bm u,\bm v\in\mathcal U$, we have $\bm u+\bm v\in\mathcal U$, and for any $a\in\mathbb R$ and $\bm u\in\mathcal U$, we have $a\bm u\in\mathcal U$.

You may notice that the definition places more emphasis on the **closure properties required for $\mathcal U$ to be a vector space** than on the **"sub" aspect** of being a subspace.

## Finite Dimensional Vector Space

> **Definition 2.3:** A vector space $\mathcal V$ is finite dimensional if some list of vectors $\bm v_1, \bm v_2, \dots,\bm v_n\in\mathcal V$ spans the space.

Note that $\bm v_1, \bm v_2, \dots, \bm v_n$ do not have to be linearly independent, since even linearly dependent vectors can span a vector space. In other words, In other words, any list of vectors spans a vector space, namely the set of all linear combinations of those vectors.

> **Definition 2.4: Basis**

If $\bm v_1, \bm v_2, \dots, \bm v_n$ are linearly independent, then they form a basis of the vector space

$$
\mathcal V=\mathrm{span}\{\bm v_1,\bm v_2,\dots,\bm v_n\}.
$$

There is no need to discuss the completeness of the basis here. What is important is that the vector space $\mathcal V$ is defined as the span of these basis vectors. The same vectors may fail to span some larger ambient space, but this does not prevent them from being a basis of $\mathcal V$.

For example, let $n=2$ and

$$
\bm v_1=
\begin{bmatrix}
1\\
0\\
0
\end{bmatrix},
\qquad
\bm v_2=
\begin{bmatrix}
0\\
1\\
0
\end{bmatrix}.
$$

Then

$$
\mathcal V
=
\mathrm{span}\{\bm v_1,\bm v_2\}
=
\left\{
\sum_{i=1}^2\alpha_i\bm v_i
:\alpha_i\in\mathbb R
\right\}
=
\left\{
\begin{bmatrix}
\alpha_1\\
\alpha_2\\
0
\end{bmatrix}
:\alpha_1,\alpha_2\in\mathbb R
\right\}.
$$

This example may seem somewhat artificial, since both $\bm v_1$ and $\bm v_2$ lie in $\mathbb R^3$. However, they do not form a basis of $\mathbb R^3$ because they do not span all of $\mathbb R^3$. They do form a complete basis of the two-dimensional subspace $\mathcal V$ that they span.

## Real Inner Product and Norms

> **Definition 2.5: Inner Product**

An inner product on a vector space $\mathcal V$ is a map

$$
\langle\cdot,\cdot\rangle:\mathcal V\times\mathcal V\rightarrow\mathbb R.
$$

Here, $\mathcal V\times\mathcal V$ denotes the **Cartesian product** of $\mathcal V$ with itself, meaning that the inner product takes two vectors from the same space $\mathcal V$ as inputs and returns a real number. In this sense, an inner product can be viewed as an operation acting on a pair of vectors.

The specific rule for computing the inner product is not unique. Different inner products can be defined on the same vector space, provided that they satisfy the defining properties of an inner product.

Also, a vector space does not need an inner product in order to be a vector space. An inner product is additional structure that may be imposed on it. For example, consider $\mathcal V=\mathbb R^2$. One possible inner product is

$$
\left\langle \bm v_1,\bm v_2\right\rangle
=
\bm v_1\cdot\bm v_2,
$$

which is the standard dot product. Alternatively, we may define

$$
\left\langle \bm v_1,\bm v_2\right\rangle
=
100\,\bm v_1\cdot\bm v_2.
$$

This is also a valid inner product on $\mathbb R^2$, showing that the inner product is not uniquely determined by the vector space itself.

> **Definition 2.6: Norm**

A norm on $\mathcal V$ is a map $\Vert\cdot\Vert:\mathcal V\rightarrow\mathbb R_{\ge 0}$ such that, for all $\bm u,\bm v\in\mathcal V$ and $a\in\mathbb R$,

$$
\Vert a\bm u\Vert=|a|\Vert\bm u\Vert,\qquad
\Vert\bm u+\bm v\Vert\le\Vert\bm u\Vert+\Vert\bm v\Vert,\qquad
\Vert\bm u\Vert=0\ \text{iff}\ \bm u=\bm 0.
$$

Every inner product induces a norm through

$$
\Vert\bm u\Vert=\sqrt{\left\langle\bm u,\bm u\right\rangle}.
$$

In other words, a norm provides a way to measure the **magnitude or size** of vectors in the space.

## Euclidean Space

> **Definition 2.7:** An Euclidean vector space $\mathbb E$ is a finite dimensional real inner product space.

Note that an $n$ dimensional Euclidean space is denoted by $\mathbb E^n$, and the norm of $\mathbb E^n$ is induced by the inner product. <font color=red> The Euclidean inner product between two vectors $\bm a$ and $\bm b$ is denoted by $\bm a\cdot \bm b$.</font> 

> **Definition 2.8:** An **affine point space** $\mathcal E$ can be viewed as a space of points associated with a vector space $\mathcal V$, but with no distinguished origin. Unlike vectors, two points cannot be added directly.

An affine point space cannot be represented by coordinates without first specifying an origin and corresponding basis. Intuitively, adding two positions has no intrinsic meaning, whereas the difference between two points is a vector. We reserve the term **point** for elements of $\mathcal E$ and the term **vector** for elements of the associated vector space $\mathbb E$. These two spaces are related through the operations of adding a vector to a point and subtracting one point from another.

> **Definition 2.9: Euclidean space**

The pair $(\mathcal E,\mathbb E)$ is called a **Euclidean space**, where $\mathcal E$ is an affine point space and its associated vector space $\mathbb E$ is a Euclidean vector space. The elements of $\mathcal E$ are called **points**, while the elements of $\mathbb E$ are called **vectors**.

Once a point $O\in\mathcal E$ is chosen as the origin, every point $P\in\mathcal E$ can be associated with a position vector $\bm p\in\mathbb E$ through

$$
\bm p=P-O,
$$

or equivalently,

$$
P=O+\bm p.
$$

Thus, a point itself does not depend on the choice of origin, but its position vector does. In physical Euclidean space, vectors in $\mathbb E$ are assigned units of length.

## Components of Vectors

A vector itself should be distinguished from its **components** with respect to **a chosen basis**. Let

$$
\mathcal B=\{\bm e_1,\bm e_2,\dots,\bm e_n\}
$$

be a basis of $\mathbb E^n$. Then every vector $\bm x\in\mathbb E^n$ can be written uniquely as

$$
\bm x=\sum_{i=1}^n x_i\bm e_i,
$$

where $x_1,\dots,x_n\in\mathbb R$ are the components of $\bm x$ with respect to the basis $\mathcal B$. These components can be collected into a column matrix,

$$
[\bm x]_{\mathcal B}
=
\begin{bmatrix}
x_1\\
\vdots\\
x_n
\end{bmatrix}.
$$

Thus, the column matrix is not the vector itself, but a coordinate representation of the vector relative to a chosen basis. The same vector may have different components under different basis.

When representing a vector, we should not write only a column matrix without specifying the basis. We should either state the chosen basis beforehand or write the vector explicitly as a linear combination of the basis vectors.

---

> First edited on Sep. 13, 2026, at River House. I was not surprised that the first course would begin with some mathematical preliminaries. However, I honestly did not realize that there were so many subtle details involved in vector spaces!
>
> Last edited on Sep. 14, 2026.